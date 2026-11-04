import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { verifyPassword, signSessionToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`login:${ip}`, RATE_LIMIT_POLICIES.LOGIN);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    const body = await request.json();
    const { email, password } = body;

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email/username and password are required.' },
        { status: 400 }
      );
    }

    const normalizedIdentifier = String(email).trim().toLowerCase();

    // Check user by normalized email or username
    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedIdentifier },
          { username: normalizedIdentifier },
        ],
      },
    });

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your username/email and password.' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { error: 'This account has been deactivated. Contact your platform administrator.' },
        { status: 403 }
      );
    }

    const isMatch = await verifyPassword(String(password), user.passwordHash);
    if (!isMatch) {
      return NextResponse.json(
        { error: 'Invalid credentials. Please verify your username/email and password.' },
        { status: 401 }
      );
    }

    const sessionPayload = {
      id: user.id,
      email: user.email,
      name: user.name,
      username: user.username,
      role: user.role as 'ADMIN' | 'USER',
      isEmailVerified: user.isEmailVerified,
      sessionVersion: user.sessionVersion ?? 1,
    };

    const token = await signSessionToken(sessionPayload, user.sessionVersion ?? 1);

    const response = NextResponse.json({
      success: true,
      user: sessionPayload,
      message: `Welcome back, ${user.name}!`,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('Login error:', error);
    const errMsg = String(error?.message || '');
    let userMsg = 'Authentication service temporarily unavailable. Please try again later.';

    if (errMsg.includes('AUTH_SECRET')) {
      userMsg = 'Configuration notice: AUTH_SECRET environment variable is missing in Vercel. Please set AUTH_SECRET in your Vercel project settings.';
    } else if (errMsg.includes('does not exist') || errMsg.includes('relation') || errMsg.includes('table')) {
      userMsg = 'Database setup required: Database tables have not been created yet in Supabase. Please run the SQL migration.';
    } else if (errMsg.includes('Can\'t reach database server') || errMsg.includes('P1001') || errMsg.includes('connect') || errMsg.includes('timeout')) {
      userMsg = 'Database connection error: Unable to reach database server. Please check DATABASE_URL in Vercel or Supabase project status.';
    }

    return NextResponse.json(
      { error: userMsg, technicalDetail: process.env.NODE_ENV !== 'production' ? errMsg : undefined },
      { status: 500 }
    );
  }
}
