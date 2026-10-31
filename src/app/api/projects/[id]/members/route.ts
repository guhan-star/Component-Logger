import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getProjectRole } from '@/lib/project-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: list members of project
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id } = await context.params;
  const perm = await getProjectRole(id, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  const members = await prisma.projectMember.findMany({
    where: { projectId: id },
    include: {
      user: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { joinedAt: 'asc' },
  });

  return NextResponse.json({
    members,
    count: members.length,
    maxMembers: 6,
  });
}

// DELETE: remove a member or leave project
export async function DELETE(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  const { searchParams } = new URL(request.url);
  let targetUserId = searchParams.get('userId');

  if (!targetUserId) {
    try {
      const body = await request.json();
      targetUserId = body.userId;
    } catch {
      // no body
    }
  }

  if (!targetUserId) {
    return NextResponse.json({ error: 'Target userId is required.' }, { status: 400 });
  }

  // Check permissions:
  // 1. Owner can remove any non-owner member.
  // 2. A non-owner member can remove themselves (leave project).
  if (perm.role === 'OWNER') {
    if (targetUserId === user.id) {
      return NextResponse.json(
        { error: 'Project owners cannot remove themselves. Delete the project or transfer ownership.' },
        { status: 400 }
      );
    }
  } else {
    if (targetUserId !== user.id) {
      return NextResponse.json(
        { error: 'Only the project owner can remove other members from this project.' },
        { status: 403 }
      );
    }
  }

  const deleted = await prisma.projectMember.deleteMany({
    where: {
      projectId,
      userId: targetUserId,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Member not found in project.' }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: targetUserId === user.id ? 'You left the project.' : 'Member removed from project.',
  });
}

// PATCH: update member role (OWNER only)
export async function PATCH(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized || perm.role !== 'OWNER') {
    return NextResponse.json({ error: 'Only the project owner can change member roles.' }, { status: 403 });
  }

  const body = await request.json();
  const { userId: targetUserId, role: newRole } = body;

  if (!targetUserId || !['EDITOR', 'VIEWER'].includes(newRole)) {
    return NextResponse.json({ error: 'Valid userId and role (EDITOR or VIEWER) are required.' }, { status: 400 });
  }

  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'Cannot change role of project owner.' }, { status: 400 });
  }

  const updated = await prisma.projectMember.update({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
    data: { role: newRole },
  });

  return NextResponse.json({ success: true, member: updated });
}
