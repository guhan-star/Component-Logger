import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { getProjectRole, canAddMember, MAX_PROJECT_MEMBERS } from '@/lib/project-auth';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET: list pending invitations for this project
export async function GET(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  const invitations = await prisma.projectInvitation.findMany({
    where: {
      projectId,
      status: 'PENDING',
    },
    include: {
      invitedUser: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
      inviter: {
        select: { id: true, username: true, name: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invitations });
}

// POST: invite an operator friend to project team
export async function POST(request: NextRequest, context: RouteContext) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { id: projectId } = await context.params;
  const perm = await getProjectRole(projectId, user.id);
  if (!perm.authorized) {
    return NextResponse.json({ error: perm.error }, { status: perm.statusCode || 403 });
  }

  // Only OWNER or EDITOR can invite
  if (perm.role !== 'OWNER' && perm.role !== 'EDITOR') {
    return NextResponse.json(
      { error: 'Only project owners and editors can invite new team members.' },
      { status: 403 }
    );
  }

  // Strict 6-member limit check
  const memberCheck = await canAddMember(projectId);
  if (!memberCheck.allowed) {
    return NextResponse.json(
      { error: `Project team is at maximum capacity (${MAX_PROJECT_MEMBERS} members). Cannot invite more operators.` },
      { status: 400 }
    );
  }

  const body = await request.json();
  const { targetUserId, role = 'VIEWER' } = body;

  if (!targetUserId) {
    return NextResponse.json({ error: 'Target user ID is required.' }, { status: 400 });
  }

  if (!['EDITOR', 'VIEWER'].includes(role)) {
    return NextResponse.json({ error: 'Assigned role must be EDITOR or VIEWER.' }, { status: 400 });
  }

  // Cannot invite oneself
  if (targetUserId === user.id) {
    return NextResponse.json({ error: 'You cannot invite yourself to a project.' }, { status: 400 });
  }

  // Check if target user is an accepted friend of inviter or owner
  const inviterUser1 = user.id < targetUserId ? user.id : targetUserId;
  const inviterUser2 = user.id < targetUserId ? targetUserId : user.id;

  const isFriendOfInviter = await prisma.friendship.findUnique({
    where: {
      user1Id_user2Id: {
        user1Id: inviterUser1,
        user2Id: inviterUser2,
      },
    },
  });

  if (!isFriendOfInviter) {
    // If inviter is EDITOR, also check if friend of OWNER
    let isFriendOfOwner = false;
    if (perm.project.ownerId !== user.id) {
      const ownerUser1 = perm.project.ownerId < targetUserId ? perm.project.ownerId : targetUserId;
      const ownerUser2 = perm.project.ownerId < targetUserId ? targetUserId : perm.project.ownerId;
      const checkOwnerFriendship = await prisma.friendship.findUnique({
        where: {
          user1Id_user2Id: {
            user1Id: ownerUser1,
            user2Id: ownerUser2,
          },
        },
      });
      if (checkOwnerFriendship) isFriendOfOwner = true;
    }

    if (!isFriendOfInviter && !isFriendOfOwner) {
      return NextResponse.json(
        { error: 'You can only invite operators who are in your accepted friends roster.' },
        { status: 400 }
      );
    }
  }

  // Check if target is already a member
  const existingMember = await prisma.projectMember.findUnique({
    where: {
      projectId_userId: {
        projectId,
        userId: targetUserId,
      },
    },
  });

  if (existingMember) {
    return NextResponse.json({ error: 'This operator is already a member of this project.' }, { status: 400 });
  }

  // Check if there is already a pending invitation
  const existingInvitation = await prisma.projectInvitation.findFirst({
    where: {
      projectId,
      invitedUserId: targetUserId,
      status: 'PENDING',
    },
  });

  if (existingInvitation) {
    return NextResponse.json({ error: 'A pending invitation has already been sent to this operator.' }, { status: 400 });
  }

  // Create project invitation
  const invitation = await prisma.projectInvitation.create({
    data: {
      projectId,
      inviterId: user.id,
      invitedUserId: targetUserId,
      role,
      status: 'PENDING',
    },
    include: {
      invitedUser: {
        select: { id: true, username: true, name: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    invitation,
    message: `Invitation sent to @${invitation.invitedUser.username} with role ${role}.`,
  });
}
