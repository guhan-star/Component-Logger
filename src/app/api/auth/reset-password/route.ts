import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { z } from 'zod';

const resetPasswordSchema = z.object({
  token: z.string().trim().min(1, 'Reset token is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`reset_submit:${ip}`, RATE_LIMIT_POLICIES.RESET_PASSWORD);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = resetPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Validation error' }, { status: 400 });
    }

    const { token, newPassword } = parsed.data;
    const tokenHash = hashToken(token);

    // Look up token record
    const record = await prisma.passwordResetToken.findUnique({
      where: { tokenHash },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or unrecognized password reset token. Please request a new link.', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    if (record.usedAt) {
      return NextResponse.json(
        { error: 'This password reset link has already been used. Please request a new one.', code: 'TOKEN_ALREADY_USED' },
        { status: 400 }
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { error: 'This password reset link has expired. Please request a new password reset.', code: 'TOKEN_EXPIRED' },
        { status: 400 }
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    // ATOMIC TRANSACTION: Consume token, update password, and REVOKE ALL SESSIONS by incrementing sessionVersion
    await prisma.$transaction(async (tx) => {
      // 1. Mark token as consumed
      await tx.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // 2. Update user's password and increment sessionVersion (revokes all active sessions across all devices)
      await tx.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: newPasswordHash,
          sessionVersion: { increment: 1 },
        },
      });

      // 3. Mark all session records as revoked
      try {
        await (tx as any).userSession?.updateMany({
          where: { userId: record.userId, isRevoked: false },
          data: { isRevoked: true },
        });
      } catch {
        // Safe fallback
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been successfully updated. All active sessions have been revoked. Please sign in with your new password.',
    });
  } catch (error: any) {
    console.error('POST /api/auth/reset-password error:', error);
    return NextResponse.json(
      { error: 'Failed to reset password. Please try again later.' },
      { status: 500 }
    );
  }
}
