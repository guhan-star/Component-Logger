import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';
import { generateSecureToken, hashToken } from '@/lib/tokens';
import { sendEmail, buildPasswordResetEmail } from '@/lib/email';
import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Please enter a valid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`forgot_pwd:${ip}`, RATE_LIMIT_POLICIES.FORGOT_PASSWORD);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json().catch(() => ({}));
    const parsed = forgotPasswordSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message || 'Invalid email address' }, { status: 400 });
    }

    const { email } = parsed.data;

    // Standard generic response to strictly prevent user enumeration
    const genericResponse = NextResponse.json({
      success: true,
      message: 'If an account with that email exists, password reset instructions have been sent to your inbox.',
    });

    const user = await prisma.user.findUnique({
      where: { email },
    });

    // If user does not exist or is inactive, return the generic response without generating tokens
    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Invalidate any older outstanding unused reset tokens for this user
    await prisma.passwordResetToken.deleteMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
    });

    // Generate high-entropy token and store only its SHA-256 hash
    const rawToken = generateSecureToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour expiration

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Send reset email via transactional provider (Resend)
    const emailPayload = buildPasswordResetEmail(user.name, rawToken, user.email);
    await sendEmail({
      to: user.email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    });

    return genericResponse;
  } catch (error: any) {
    console.error('POST /api/auth/forgot-password error:', error);
    return NextResponse.json(
      { error: 'Failed to process password recovery request. Please try again later.' },
      { status: 500 }
    );
  }
}
