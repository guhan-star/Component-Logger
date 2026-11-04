import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, revokeAllUserSessions, signSessionToken, COOKIE_NAME } from '@/lib/auth';
import { checkRateLimit, rateLimitResponse, getClientIp, RATE_LIMIT_POLICIES } from '@/lib/rate-limit';

// POST /api/profile/revoke-sessions - Invalidate all other active sessions across devices
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth();
    if ('error' in authResult) return authResult.response;
    const { user } = authResult;

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit(`revoke_sessions:${user.id}:${ip}`, RATE_LIMIT_POLICIES.DEFAULT_API);
    if (!rateLimit.success) {
      return rateLimitResponse(rateLimit);
    }

    // Increment sessionVersion on user record
    const newSessionVersion = await revokeAllUserSessions(user.id);

    // Re-issue a fresh token for current device
    const updatedPayload = {
      ...user,
      sessionVersion: newSessionVersion,
    };

    const newToken = await signSessionToken(updatedPayload, newSessionVersion);

    const response = NextResponse.json({
      success: true,
      message: 'All other active sessions have been revoked. Current device session refreshed.',
      sessionVersion: newSessionVersion,
    });

    response.cookies.set({
      name: COOKIE_NAME,
      value: newToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    return response;
  } catch (error: any) {
    console.error('POST /api/profile/revoke-sessions error:', error);
    return NextResponse.json(
      { error: error?.message || 'Failed to revoke sessions' },
      { status: 500 }
    );
  }
}
