import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { hashPassword, signSessionToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, getClientIp } from '@/lib/rate-limit';
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
    // 1. Rate limiting (max 5 registration attempts per 5 minutes per IP)
    const ip = getClientIp(request);
    const rateLimit = checkRateLimit(`register:${ip}`, { windowMs: 5 * 60 * 1000, max: 5 });
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please wait a few minutes before trying again.' },
        { status: 429 }
      );
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

    // 4. Create user with default USER role (Admin provisioning is a separate controlled procedure)
    const newUser = await prisma.user.create({
      data: {
        name,
        username,
        email,
        passwordHash,
        role: 'USER',
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

    // Seed default user-scoped dropdowns using createMany
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

    // 5. Sign JWT session cookie
    const sessionPayload = {
      id: newUser.id,
      email: newUser.email,
      name: newUser.name,
      username: newUser.username,
      role: newUser.role as 'ADMIN' | 'USER',
    };

    const token = await signSessionToken(sessionPayload);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
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
      userMsg = 'Configuration error: AUTH_SECRET environment variable is missing in Vercel.';
    } else if (errMsg.includes('does not exist') || errMsg.includes('relation') || errMsg.includes('table')) {
      userMsg = 'Database setup required: Database tables have not been created yet in Supabase. Please run the SQL migration.';
    } else if (errMsg.includes('Can\'t reach database server') || errMsg.includes('P1001') || errMsg.includes('connect')) {
      userMsg = 'Database connection error: Unable to reach database server. Please check DATABASE_URL in Vercel.';
    }

    return NextResponse.json(
      { error: userMsg, technicalDetail: errMsg },
      { status: 500 }
    );
  }
}
