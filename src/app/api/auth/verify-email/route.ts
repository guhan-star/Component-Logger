import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';
import { hashToken } from '@/lib/tokens';
import { z } from 'zod';

const verifySchema = z.object({
  token: z.string().trim().min(1, 'Verification token is required'),
});

// POST /api/auth/verify-email - Validate and atomically consume verification token
export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`verify_submit:${ip}`, RATE_LIMIT_POLICIES.VERIFY_EMAIL_SUBMIT);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = verifySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid input' }, { status: 400 });
    }

    const { token } = parsed.data;
    const incomingHash = hashToken(token);

    // Look up by tokenHash (or legacy plain token for safe migration)
    const record = await prisma.emailVerificationToken.findFirst({
      where: {
        OR: [
          { tokenHash: incomingHash },
          { token: token },
        ],
      },
      include: {
        user: {
          select: { id: true, email: true, isEmailVerified: true },
        },
      },
    });

    if (!record) {
      return NextResponse.json(
        { error: 'Invalid or unrecognized email verification link. It may have expired or been replaced.', code: 'INVALID_TOKEN' },
        { status: 400 }
      );
    }

    if (record.usedAt) {
      return NextResponse.json(
        { error: 'This verification token has already been consumed. Please sign in.', code: 'TOKEN_ALREADY_USED' },
        { status: 400 }
      );
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json(
        { error: 'This verification token has expired. Please request a new verification email.', code: 'TOKEN_EXPIRED' },
        { status: 400 }
      );
    }

    // Atomically consume token and verify user email
    await prisma.$transaction(async (tx) => {
      // Mark token as consumed
      await tx.emailVerificationToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      });

      // Update user status
      await tx.user.update({
        where: { id: record.userId },
        data: {
          isEmailVerified: true,
          emailVerifiedAt: new Date(),
          ...(record.newEmail && record.newEmail !== record.user.email ? { email: record.newEmail } : {}),
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Your email address has been successfully verified! You may now access all features.',
    });
  } catch (error: any) {
    console.error('POST /api/auth/verify-email error:', error);
    return NextResponse.json(
      { error: 'Failed to verify email token. Please try again later.' },
      { status: 500 }
    );
  }
}

// GET /api/auth/verify-email?token=... - Quick validation check for token state
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json({ error: 'Token is required.' }, { status: 400 });
    }

    const incomingHash = hashToken(token);
    const record = await prisma.emailVerificationToken.findFirst({
      where: {
        OR: [
          { tokenHash: incomingHash },
          { token: token },
        ],
      },
    });

    if (!record) {
      return NextResponse.json({ valid: false, code: 'INVALID_TOKEN', error: 'Verification token is invalid or unrecognized.' });
    }

    if (record.usedAt) {
      return NextResponse.json({ valid: false, code: 'TOKEN_ALREADY_USED', error: 'This verification token has already been used.' });
    }

    if (new Date() > record.expiresAt) {
      return NextResponse.json({ valid: false, code: 'TOKEN_EXPIRED', error: 'This verification token has expired.' });
    }

    return NextResponse.json({ valid: true, expiresAt: record.expiresAt });
  } catch (error: any) {
    console.error('GET /api/auth/verify-email error:', error);
    return NextResponse.json({ valid: false, error: 'Failed to check token.' }, { status: 500 });
  }
}
