import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// GET: list incoming and outgoing pending friend requests
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const [incoming, outgoing] = await Promise.all([
    prisma.friendRequest.findMany({
      where: {
        receiverId: user.id,
        status: 'PENDING',
      },
      include: {
        sender: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.friendRequest.findMany({
      where: {
        senderId: user.id,
        status: 'PENDING',
      },
      include: {
        receiver: {
          select: { id: true, username: true, name: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return NextResponse.json({ incoming, outgoing });
}

// POST: send a friend request
export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  // Rate limit: max 10 requests per 10 minutes
  const ip = getClientIp(request);
  const rateLimit = await checkRateLimit(`friend-req:${user.id}:${ip}`, { windowMs: 10 * 60 * 1000, max: 10 });
  if (!rateLimit.success) {
    return NextResponse.json(
      { error: 'Too many friend requests sent recently. Please wait a few minutes.' },
      { status: 429 }
    );
  }

  const body = await request.json();
  const targetId = body.targetUserId || body.receiverId;
  const targetUsername = body.username ? String(body.username).trim().toLowerCase() : undefined;

  let targetUser = null;
  if (targetId) {
    targetUser = await prisma.user.findUnique({
      where: { id: targetId },
      select: { id: true, username: true, name: true, isActive: true },
    });
  } else if (targetUsername) {
    targetUser = await prisma.user.findUnique({
      where: { username: targetUsername },
      select: { id: true, username: true, name: true, isActive: true },
    });
  }

  if (!targetUser || !targetUser.isActive) {
    return NextResponse.json({ error: 'Operator not found.' }, { status: 404 });
  }

  if (targetUser.id === user.id) {
    return NextResponse.json({ error: 'You cannot add yourself as a friend.' }, { status: 400 });
  }

  // Check if already friends
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

  if (existingFriendship) {
    return NextResponse.json({ error: 'You are already friends with this operator.' }, { status: 400 });
  }

  // Check if target user already sent a pending request to caller -> auto-accept
  const reciprocalRequest = await prisma.friendRequest.findFirst({
    where: {
      senderId: targetUser.id,
      receiverId: user.id,
      status: 'PENDING',
    },
  });

  if (reciprocalRequest) {
    // Transaction: accept request and establish friendship
    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id: reciprocalRequest.id },
        data: { status: 'ACCEPTED' },
      }),
      prisma.friendship.upsert({
        where: {
          user1Id_user2Id: {
            user1Id: user1,
            user2Id: user2,
          },
        },
        create: {
          user1Id: user1,
          user2Id: user2,
        },
        update: {},
      }),
    ]);

    return NextResponse.json({
      success: true,
      message: 'Mutual request detected. Friendship established!',
      autoAccepted: true,
    });
  }

  // Check if caller already sent an active pending request
  const alreadySent = await prisma.friendRequest.findFirst({
    where: {
      senderId: user.id,
      receiverId: targetUser.id,
      status: 'PENDING',
    },
  });

  if (alreadySent) {
    return NextResponse.json({ error: 'Friend request is already pending.' }, { status: 400 });
  }

  // Create friend request
  const newRequest = await prisma.friendRequest.create({
    data: {
      senderId: user.id,
      receiverId: targetUser.id,
      status: 'PENDING',
    },
    include: {
      receiver: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
  });

  return NextResponse.json({
    success: true,
    request: newRequest,
    message: `Friend request sent to @${targetUser.username}.`,
  });
}
