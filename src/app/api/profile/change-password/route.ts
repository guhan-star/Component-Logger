import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, verifyPassword, hashPassword } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmNewPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmNewPassword, {
  message: 'New passwords do not match',
  path: ['confirmNewPassword'],
});

// POST /api/profile/change-password - Secure password change with current password verification
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    // Rate limiting
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`change-pw:${user.id}:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 5,
    });

    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password update attempts. Please wait 15 minutes before trying again.' },
        { status: 429 }
      );
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

    // Hash and update new password
    const newHash = await hashPassword(newPassword);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Password successfully changed. Your account credentials are now updated.',
    });
  } catch (error: any) {
    console.error('POST /api/profile/change-password error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to change password' }, { status: 500 });
  }
}
