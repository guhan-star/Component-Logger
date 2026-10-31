import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';

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

  if (!['ACCEPT', 'REJECT', 'CANCEL'].includes(action || '')) {
    return NextResponse.json({ error: 'Action must be ACCEPT, REJECT, or CANCEL' }, { status: 400 });
  }

  const friendReq = await prisma.friendRequest.findUnique({
    where: { id },
  });

  if (!friendReq) {
    return NextResponse.json({ error: 'Friend request not found.' }, { status: 404 });
  }

  if (friendReq.status !== 'PENDING') {
    return NextResponse.json({ error: `Request is already ${friendReq.status.toLowerCase()}.` }, { status: 400 });
  }

  if (action === 'ACCEPT' || action === 'REJECT') {
    // Only the receiver can accept or reject
    if (friendReq.receiverId !== user.id) {
      return NextResponse.json({ error: 'You are not authorized to respond to this request.' }, { status: 403 });
    }

    if (action === 'REJECT') {
      await prisma.friendRequest.update({
        where: { id },
        data: { status: 'REJECTED' },
      });
      return NextResponse.json({ success: true, message: 'Friend request rejected.' });
    }

    // ACCEPT action
    const user1 = friendReq.senderId < user.id ? friendReq.senderId : user.id;
    const user2 = friendReq.senderId < user.id ? user.id : friendReq.senderId;

    await prisma.$transaction([
      prisma.friendRequest.update({
        where: { id },
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

    return NextResponse.json({ success: true, message: 'Friend request accepted.' });
  }

  if (action === 'CANCEL') {
    // Only sender can cancel
    if (friendReq.senderId !== user.id) {
      return NextResponse.json({ error: 'Only the sender can cancel this request.' }, { status: 403 });
    }

    await prisma.friendRequest.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    return NextResponse.json({ success: true, message: 'Friend request cancelled.' });
  }

  return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
}
