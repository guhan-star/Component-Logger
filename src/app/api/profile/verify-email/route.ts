import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { z } from 'zod';

const verifyEmailSchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
});

// POST /api/profile/verify-email - Validate token and update authenticated user's email
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const body = await request.json();
    const parsed = verifyEmailSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { token } = parsed.data;

    const record = await prisma.emailVerificationToken.findUnique({
      where: { token },
    });

    if (!record || record.userId !== user.id) {
      return NextResponse.json({ error: 'Invalid or unrecognized email verification token.' }, { status: 400 });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ error: 'Verification token has expired. Please request a new verification token.' }, { status: 400 });
    }

    // Update user's email
    await prisma.user.update({
      where: { id: user.id },
      data: { email: record.newEmail },
    });

    // Delete token
    await prisma.emailVerificationToken.delete({
      where: { id: record.id },
    });

    return NextResponse.json({
      success: true,
      message: 'Email address has been successfully verified and updated.',
      newEmail: record.newEmail,
    });
  } catch (error: any) {
    console.error('POST /api/profile/verify-email error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to verify email' }, { status: 500 });
  }
}
