import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const emailChangeSchema = z.object({
  newEmail: z.string().trim().toLowerCase().email('Invalid email address format'),
});

// POST /api/profile/request-email-change - Generate genuine verification token
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`req-email:${user.id}:${ip}`, {
      windowMs: 15 * 60 * 1000,
      max: 3,
    });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many email update requests. Please wait 15 minutes.' },
        { status: 429 }
      );
    }

    const body = await request.json();
    const parsed = emailChangeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message }, { status: 400 });
    }

    const { newEmail } = parsed.data;

    if (newEmail === user.email) {
      return NextResponse.json({ error: 'New email is identical to your current email address.' }, { status: 400 });
    }

    // Check if new email is already registered
    const existing = await prisma.user.findUnique({
      where: { email: newEmail },
    });
    if (existing) {
      return NextResponse.json({ error: 'This email address is already in use by another account.' }, { status: 409 });
    }

    // Generate secure random token valid for 24 hours
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    // Save token
    await prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        newEmail,
        token,
        expiresAt,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Verification token generated. In a configured environment, a verification email is dispatched.',
      token, // Returned for verification completion
    });
  } catch (error: any) {
    console.error('POST /api/profile/request-email-change error:', error);
    return NextResponse.json({ error: error?.message || 'Failed to request email change' }, { status: 500 });
  }
}
