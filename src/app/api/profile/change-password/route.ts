import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, verifyPassword, hashPassword, signSessionToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmNewPassword: z.string(),
  revokeOtherSessions: z.boolean().optional().default(true),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword'],
});

// POST /api/profile/change-password - Secure password change with session revocation
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    // Rate limiting
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`change_pw:${user.id}:${ip}`, RATE_LIMIT_POLICIES.RESET_PASSWORD);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = changePasswordSchema.safeParse(body);

    if (!parsed.success) {
      const err = parsed.error.issues[0]?.message || 'Validation error';
      return NextResponse.json({ error: err }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    // Fetch user password hash
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
    });

    if (!dbUser) {
      return NextResponse.json({ error: 'User account not found' }, { status: 404 });
    }

    // Verify current password
    const isCurrentValid = await verifyPassword(currentPassword, dbUser.passwordHash);
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'Incorrect current password. Please re-enter your current password.' },
        { status: 401 }
      );
    }

    // Hash and update new password, incrementing sessionVersion to revoke other devices
    const newHash = await hashPassword(newPassword);
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newHash,
        sessionVersion: { increment: 1 },
      },
    });

    // Mark other session records as revoked
    try {
      await (prisma as any).userSession?.updateMany({
        where: { userId: user.id },
        data: { isRevoked: true },
      });
    } catch {
      // Safe fallback
    }

    // Issue updated session token for the current user session so they stay logged in
    const newSessionPayload = {
      id: updatedUser.id,
      email: updatedUser.email,
      name: updatedUser.name,
      username: updatedUser.username,
      role: updatedUser.role as any,
      isEmailVerified: updatedUser.isEmailVerified,
      sessionVersion: updatedUser.sessionVersion,
    };

    const newToken = await signSessionToken(newSessionPayload, updatedUser.sessionVersion);

    const response = NextResponse.json({
      success: true,
      message: 'Password successfully changed. All other sessions have been revoked for your security.',
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('POST /api/profile/change-password error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to change password' }, { status: 500 });
  }
}
