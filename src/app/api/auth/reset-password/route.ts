import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';

const resetSchema = z.object({
  email: z.string().trim().toLowerCase().email('Invalid email address'),
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
    const rateLimit = checkRateLimit(`reset:${ip}`, { windowMs: 15 * 60 * 1000, max: 5 });
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

    const { email, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'No registered account found with that email address.' },
        { status: 404 }
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
      { error: 'Failed to reset password. Please check your database connection or try again later.' },
      { status: 500 }
    );
  }
}
