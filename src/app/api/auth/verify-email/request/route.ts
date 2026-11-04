import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';
import { generateSecureToken, hashToken } from '@/lib/tokens';
import { sendEmail, buildVerificationEmail } from '@/lib/email';
import { z } from 'zod';

const requestSchema = z.object({
  email: z.string().trim().toLowerCase().email().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`verify_request:${ip}`, RATE_LIMIT_POLICIES.VERIFY_EMAIL_REQUEST);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = requestSchema.safeParse(body);
    let targetEmail = parsed.success && parsed.data.email ? parsed.data.email : undefined;

    // Check if user is logged in
    const sessionUser = await getSession();
    if (!targetEmail && sessionUser?.email) {
      targetEmail = sessionUser.email;
    }

    if (!targetEmail) {
      return NextResponse.json(
        { error: 'Please provide the email address associated with your account.' },
        { status: 400 }
      );
    }

    // Generic response message to strictly prevent email enumeration
    const genericResponse = NextResponse.json({
      success: true,
      message: 'If an unverified account with this email address exists, a verification link has been sent.',
    });

    const user = await prisma.user.findUnique({
      where: { email: targetEmail },
    });

    // If user does not exist or is already verified, return generic response without sending email
    if (!user || user.isEmailVerified) {
      return genericResponse;
    }

    // Invalidate previous outstanding tokens for this user
    await prisma.emailVerificationToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // Generate cryptographically secure token and store only SHA-256 hash
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        newEmail: user.email,
        tokenHash,
        expiresAt,
      },
    });

    // Dispatch email
    const emailPayload = buildVerificationEmail(user.name, rawToken, user.email);
    await sendEmail({
      to: user.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    });

    return genericResponse;
  } catch (error: any) {
    console.error('POST /api/auth/verify-email/request error:', error);
    return NextResponse.json(
      { error: 'Failed to request verification email. Please try again later.' },
      { status: 500 }
    );
  }
}
