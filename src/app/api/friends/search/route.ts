import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  // Rate limit searches: max 30 per minute
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`search-friends:${user.id}:${ip}`, { windowMs: 60 * 1000, max: 30 });
  if (!rateLimit.success) {
    return NextResponse.json({ error: 'Search rate limit exceeded. Please wait.' }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const rawQuery = searchParams.get('username') || searchParams.get('q');

  if (!rawQuery) {
    return NextResponse.json({ error: 'Username query parameter is required.' }, { status: 400 });
  }

  const normalized = rawQuery.trim().toLowerCase();

  // Exact username lookup only - never allow wildcard directory search
  const targetUser = await prisma.user.findUnique({
    where: { username: normalized },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
      isActive: true,
    },
  });

  if (!targetUser || !targetUser.isActive || targetUser.id === user.id) {
    return NextResponse.json({ found: false, user: null }, { status: 200 });
  }

  // Determine relationship status
  const user1 = user.id < targetUser.id ? user.id : targetUser.id;
  const user2 = user.id < targetUser.id ? targetUser.id : user.id;

  const existingFriendship = await prisma.friendship.findUnique({
    where: {
      user1Id_user2Id: {
        user1Id: user1,
        user2Id: user2,
      },
    },
  });

  let relationship: 'NONE' | 'FRIEND' | 'REQUEST_SENT' | 'REQUEST_RECEIVED' = 'NONE';
  let requestId: string | null = null;

  if (existingFriendship) {
    relationship = 'FRIEND';
  } else {
    const pendingSent = await prisma.friendRequest.findFirst({
      where: {
        senderId: user.id,
        receiverId: targetUser.id,
        status: 'PENDING',
      },
      select: { id: true },
    });

    if (pendingSent) {
      relationship = 'REQUEST_SENT';
      requestId = pendingSent.id;
    } else {
      const pendingReceived = await prisma.friendRequest.findFirst({
        where: {
          senderId: targetUser.id,
          receiverId: user.id,
          status: 'PENDING',
        },
        select: { id: true },
      });

      if (pendingReceived) {
        relationship = 'REQUEST_RECEIVED';
        requestId = pendingReceived.id;
      }
    }
  }

  return NextResponse.json({
    found: true,
    user: {
      id: targetUser.id,
      username: targetUser.username,
      name: targetUser.name,
      avatarUrl: targetUser.avatarUrl,
    },
    relationship,
    requestId,
  });
}
