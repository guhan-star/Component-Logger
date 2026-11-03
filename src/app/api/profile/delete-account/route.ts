import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, verifyPassword, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';

// POST /api/profile/delete-account - Sensitive account deletion with safeguards
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    // Rate limiting
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`del-acc:${user.id}:${ip}`, {
      windowMs: 60 * 60 * 1000,
      max: 3,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many account deletion attempts. Please try again later.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const { password, confirmationText } = body;

    if (!password) {
      return NextResponse.json({ error: 'Current password is required to verify account ownership.' }, { status: 400 });
    }

    if (confirmationText !== `DELETE ${user.username}`) {
      return NextResponse.json(
        { error: `Confirmation mismatch. You must type "DELETE ${user.username}" to confirm.` },
        { status: 400 }
      );
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      include: {
        projectsOwned: {
          include: {
            members: true,
          },
        },
      },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, dbUser.passwordHash);
    if (!isPasswordValid) {
      return NextResponse.json({ error: 'Incorrect password. Account deletion denied.' }, { status: 401 });
    }

    // Collaboration safeguard: Check if user owns projects with other active team members
    const activeSharedProjects = dbUser.projectsOwned.filter((p) => p.members.length > 1);
    if (activeSharedProjects.length > 0) {
      const projectNames = activeSharedProjects.map((p) => `"${p.name}"`).join(', ');
      return NextResponse.json(
        {
          error: `Cannot delete account. You are the sole owner of collaborative projects (${projectNames}) with other team members. Please transfer project ownership or remove team members before deleting your account.`,
        },
        { status: 409 }
      );
    }

    // Cascade delete user and associated personal data
    await prisma.user.delete({
      where: { id: user.id },
    });

    // Clear auth session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Your account and personal inventory data have been permanently deleted.',
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: '',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 0,
    });

    return response;
  } catch (error: any) {
    console.error('POST /api/profile/delete-account error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete account' }, { status: 500 });
  }
}
