import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    const { user: sessionUser } = authResult;

    const user = await prisma.user.findUnique({
      where: { id: sessionUser.id },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        role: true,
        avatarUrl: true,
        isEmailVerified: true,
        sessionVersion: true,
        createdAt: true,
        settings: true,
      },
    });

    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }

    return NextResponse.json({ user }, { status: 200 });
  } catch (error) {
    console.error('Session retrieval error:', error);
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
