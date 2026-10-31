import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

// GET: list all accepted friends of the authenticated user
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const friendships = await prisma.friendship.findMany({
    where: {
      OR: [
        { user1Id: user.id },
        { user2Id: user.id },
      ],
    },
    include: {
      user1: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
      user2: {
        select: { id: true, username: true, name: true, avatarUrl: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const friends = friendships.map((f) => {
    const friend = f.user1Id === user.id ? f.user2 : f.user1;
    return {
      id: friend.id,
      username: friend.username,
      name: friend.name,
      avatarUrl: friend.avatarUrl,
      friendsSince: f.createdAt,
    };
  });

  return NextResponse.json({ friends });
}

// DELETE: remove a friendship
export async function DELETE(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.error) return auth.response;
  const user = auth.user;

  const { searchParams } = new URL(request.url);
  let friendId = searchParams.get('friendId');

  if (!friendId) {
    try {
      const body = await request.json();
      friendId = body.friendId;
    } catch {
      // no body
    }
  }

  if (!friendId) {
    return NextResponse.json({ error: 'friendId is required.' }, { status: 400 });
  }

  const user1 = user.id < friendId ? user.id : friendId;
  const user2 = user.id < friendId ? friendId : user.id;

  const deleted = await prisma.friendship.deleteMany({
    where: {
      user1Id: user1,
      user2Id: user2,
    },
  });

  if (deleted.count === 0) {
    return NextResponse.json({ error: 'Friendship not found.' }, { status: 404 });
  }

  return NextResponse.json({ success: true, message: 'Friend removed successfully.' });
}
