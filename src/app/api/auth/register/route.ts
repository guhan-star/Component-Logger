import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, signSessionToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';
import { generateSecureToken, hashToken } from '@/lib/tokens';
import { sendEmail, buildVerificationEmail } from '@/lib/email';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username cannot exceed 30 characters')
    .regex(/^[a-z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  email: z.string().trim().toLowerCase().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters long')
    .regex(/[A-Za-z]/, 'Password must contain at least one letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

const DEFAULT_DROPDOWNS: Record<string, string[]> = {
  category: ['Microcontroller', 'Sensor', 'Power', 'Passive', 'Connector', 'Semiconductor', 'Display', 'Communication', 'Tool', 'Module'],
  unit: ['Piece', 'Board', 'Module', 'Pack', 'Set', 'Pair', 'Meter', 'Centimeter', 'Roll', 'Box'],
  condition: ['New', 'Good', 'Used', 'Salvaged', 'Needs Repair'],
  status: ['In Storage', 'In Use', 'Lent Out', 'Borrowed and In Use', 'Returned', 'Lost', 'Damaged'],
  ownership: ['Mine', 'Borrowed', 'Lent'],
};

export async function POST(request: NextRequest) {
  try {
    // 1. Enforce atomic rate limiting (5 per 15 mins per IP, fails closed in production)
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`register:${ip}`, RATE_LIMIT_POLICIES.REGISTER);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const parsed = registerSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Invalid input data.' },
        { status: 400 }
      );
    }

    const { name, username, email, password } = parsed.data;

    // 2. Uniqueness verification for email & username
    const existingEmail = await prisma.user.findUnique({
      where: { email },
    });
    if (existingEmail) {
      return NextResponse.json(
        { error: 'An account with this email is already registered.' },
        { status: 409 }
      );
    }

    const existingUsername = await prisma.user.findUnique({
      where: { username },
    });
    if (existingUsername) {
      return NextResponse.json(
        { error: 'This username is already taken. Please choose another.' },
        { status: 409 }
      );
    }

    // 3. Hash password with bcrypt
    const passwordHash = await hashPassword(password);

    // 4. Create user with isEmailVerified = false and sessionVersion = 1
    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role: 'USER',
        isEmailVerified: false,
        sessionVersion: 1,
      },
    });

    // Create default user settings
    await prisma.userSettings.create({
      data: {
        userId: newUser.id,
        theme: 'dark',
        defaultCurrency: 'INR',
        defaultUnit: 'Piece',
        defaultPageSize: 25,
      },
    });

    // Create default user privacy settings with discoverable = true by default
    await prisma.userPrivacySettings.create({
      data: {
        userId: newUser.id,
        isDiscoverable: true,
        allowExactDiscovery: true,
      },
    });

    // Seed default user-scoped dropdowns
    const dropdownData: Array<{ userId: string; categoryKey: string; value: string; sortOrder: number }> = [];
    for (const [key, values] of Object.entries(DEFAULT_DROPDOWNS)) {
      values.forEach((val, idx) => {
        dropdownData.push({
          userId: newUser.id,
          categoryKey: key,
          value: val,
          sortOrder: idx,
        });
      });
    }

    if (dropdownData.length > 0) {
      await prisma.userDropdownValue.createMany({
        data: dropdownData,
      });
    }

    // 5. Generate cryptographically secure verification token (stored only as SHA-256 hash)
    const rawVerificationToken = generateSecureToken(32);
    const verificationTokenHash = hashToken(rawVerificationToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await prisma.emailVerificationToken.create({
      data: {
        userId: newUser.id,
        newEmail: email,
        tokenHash: verificationTokenHash,
        expiresAt,
      },
    });

    // 6. Send verification email via transactional provider (Resend)
    const emailPayload = buildVerificationEmail(name, rawVerificationToken, email);
    const emailResult = await sendEmail({
      to: email,
      subject: emailPayload.subject,
      html: emailPayload.html,
      text: emailPayload.text,
    });

    // 7. Sign initial JWT session cookie with sessionVersion: 1
    const sessionPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role as 'ADMIN' | 'USER',
      isEmailVerified: false,
      sessionVersion: 1,
    };

    const token = await signSessionToken(sessionPayload, 1);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      emailVerificationSent: emailResult.success,
      emailDeliveryNotice: emailResult.simulated
        ? 'Verification email simulated in local development.'
        : emailResult.success
        ? 'Verification email sent. Please check your inbox.'
        : 'Account created, but verification email could not be delivered. You can resend it from settings.',
      message: 'Account created successfully. Welcome to Stark Industries WMC.',
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error: any) {
    console.error('Registration error:', error);
    const errMsg = String(error?.message || '');
    let userMsg = 'An unexpected error occurred during registration. Please try again.';

    if (errMsg.includes('AUTH_SECRET')) {
      userMsg = 'Configuration notice: AUTH_SECRET environment variable is missing in Vercel.';
    } else if (errMsg.includes('does not exist') || errMsg.includes('relation') || errMsg.includes('table')) {
      userMsg = 'Database setup required: Database tables have not been created yet in Supabase. Please run the SQL migration.';
    } else if (errMsg.includes('the URL must start with the protocol') || errMsg.includes('datasource `db`')) {
      userMsg = 'Database configuration error: DATABASE_URL is misconfigured. When using PostgreSQL, DATABASE_URL must start with postgresql:// or postgres://.';
    } else if (errMsg.includes('Can\'t reach database server') || errMsg.includes('P1001') || errMsg.includes('connect')) {
      userMsg = 'Database connection error: Unable to reach database server. Please check DATABASE_URL in Vercel.';
    }

    return NextResponse.json(
      { error: userMsg, technicalDetail: process.env.NODE_ENV !== 'production' ? errMsg : undefined },
      { status: 500 }
    );
  }
}
