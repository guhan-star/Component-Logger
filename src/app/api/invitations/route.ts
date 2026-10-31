import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET: list all pending project invitations for the current user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const invitations = await prisma.projectInvitation.findMany({
    where: {
      invitedUserId: user.id,
      status: 'PENDING',
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          description: true,
          status: true,
          _count: { select: { members: true } },
        },
      },
      inviter: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({ invitations });
}
