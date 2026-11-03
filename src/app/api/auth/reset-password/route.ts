import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, verifyPassword, getAuthSecret } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { jwtVerify } from 'jose';
import { z } from 'zod';

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  currentPassword: z.string().optional(),
  recoveryToken: z.string().optional(),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
}).refine((data) => Boolean(data.currentPassword || data.recoveryToken), {
  message: 'Current password or recovery token is required to update credentials.',
  path: ['currentPassword'],
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`reset:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many password reset requests. Please wait a few minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = resetSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0]?.message || 'Validation error';
      return NextResponse.json({ error: firstError }, { status: 400 });
    }

    const { email, currentPassword, recoveryToken, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Return generic response to prevent email enumeration
      return NextResponse.json({
        success: true,
        message: 'If the account exists and credentials match, the password has been updated.',
      });
    }

    // Verify authorization via either current password or valid signed recovery token
    let isAuthorized = false;

    if (currentPassword) {
      isAuthorized = await verifyPassword(currentPassword, user.passwordHash);
      if (!isAuthorized) {
        return NextResponse.json(
          { error: 'Current password does not match.' },
          { status: 401 }
        );
      }
    } else if (recoveryToken) {
      try {
        const secretKey = getAuthSecret();
        const { payload } = await jwtVerify(recoveryToken, secretKey);
        if (payload?.sub === user.id && payload?.purpose === 'password_reset') {
          isAuthorized = true;
        }
      } catch {
        return NextResponse.json(
          { error: 'Recovery token is invalid or expired. Please contact support.' },
          { status: 401 }
        );
      }
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: 'Unauthorized. Valid current password or recovery token is required.' },
        { status: 401 }
      );
    }

    const passwordHash = await hashPassword(newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    return NextResponse.json({
      success: true,
      message: 'Password successfully updated! You can now sign in with your new credentials.',
    });
  } catch (error: any) {
    console.error('Password reset error:', error);
    return NextResponse.json(
      { error: 'Failed to update credentials. Please try again later.' },
      { status: 500 }
    );
  }
}
