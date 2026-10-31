import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { MAX_PROJECT_MEMBERS } from '@/lib/project-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id } = await context.params;
  const body = await request.json();
  const action = body.action ? String(body.action).toUpperCase() : null;

  if (!['ACCEPT', 'REJECT'].includes(action || '')) {
    return NextResponse.json({ error: 'Action must be ACCEPT or REJECT.' }, { status: 400 });
  }

  const invitation = await prisma.projectInvitation.findUnique({
    where: { id },
    include: { project: true },
  });

  if (!invitation) {
    return NextResponse.json({ error: 'Invitation not found.' }, { status: 404 });
  }

  if (invitation.invitedUserId !== user.id) {
    return NextResponse.json({ error: 'You are not authorized to respond to this invitation.' }, { status: 403 });
  }

  if (invitation.status !== 'PENDING') {
    return NextResponse.json({ error: `Invitation is already ${invitation.status.toLowerCase()}.` }, { status: 400 });
  }

  if (action === 'REJECT') {
    await prisma.projectInvitation.update({
      where: { id },
      data: {
        status: 'REJECTED',
        respondedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Project invitation declined.' });
  }

  // ACCEPT action - transaction with atomic 6-member limit verification
  try {
    const result = await prisma.$transaction(async (tx) => {
      // Re-verify current project member count within transaction
      const currentCount = await tx.projectMember.count({
        where: { projectId: invitation.projectId },
      });

      if (currentCount >= MAX_PROJECT_MEMBERS) {
        // Mark invitation as expired due to cap
        await tx.projectInvitation.update({
          where: { id },
          data: { status: 'EXPIRED', respondedAt: new Date() },
        });
        throw new Error(`Project team has reached its maximum limit of ${MAX_PROJECT_MEMBERS} members.`);
      }

      // Add to project members
      const newMember = await tx.projectMember.create({
        data: {
          projectId: invitation.projectId,
          userId: user.id,
          role: invitation.role,
        },
      });

      // Mark invitation as accepted
      await tx.projectInvitation.update({
        where: { id },
        data: {
          status: 'ACCEPTED',
          respondedAt: new Date(),
        },
      });

      return newMember;
    });

    return NextResponse.json({
      success: true,
      message: `Successfully joined ${invitation.project.name} as ${invitation.role}.`,
      member: result,
    });
  } catch (error: any) {
    console.error('Accept invitation transaction error:', error);
    return NextResponse.json({ error: error.message || 'Failed to join project.' }, { status: 400 });
  }
}
