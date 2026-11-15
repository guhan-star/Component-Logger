import { describe, it, expect, vi, beforeEach } from 'vitest';
import prisma from '@/lib/prisma';
import * as securityVerificationModule from '@/lib/security-verification';
import * as rateLimitModule from '@/lib/rate-limit';
import * as authModule from '@/lib/auth';
import { POST as loginRoute } from '@/app/api/auth/login/route';
import { NextRequest } from 'next/server';

describe('Integration Tests: Login Security Verification, Provider Faults & Recovery', () => {
  const mockUser = {
    id: 'usr_login_sec_test',
    email: 'sec_operator@stark.test',
    username: 'sec_op',
    name: 'Security Operator',
    passwordHash: '',
    role: 'USER',
    isActive: true,
    isEmailVerified: true,
    sessionVersion: 1,
  };

  beforeEach(async () => {
    vi.restoreAllMocks();
    mockUser.passwordHash = await authModule.hashPassword('StarkValidPassword2026!');

    // Default rate-limiter mock: allow through
    vi.spyOn(rateLimitModule, 'checkRateLimit').mockResolvedValue({
      success: true,
      limit: 10,
      remaining: 9,
      resetTime: Date.now() + 60000,
      retryAfter: 60,
      isDistributed: true,
    });

    // Mock prisma queries
    vi.spyOn(prisma.user, 'findFirst').mockImplementation(async ({ where }: any) => {
      const match = where?.OR?.some(
        (o: any) => o.email === mockUser.email || o.username === mockUser.username
      );
      return match ? ({ ...mockUser } as any) : null;
    });
  });

  const createLoginRequest = (body: Record<string, any>) => {
    return new NextRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '198.51.100.42',
      },
      body: JSON.stringify(body),
    });
  };

  // ---------------------------------------------------------------------------
  // 1. Missing verification token
  // ---------------------------------------------------------------------------
  it('1. Rejects login with HTTP 400 when verification token is missing', async () => {
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: false,
      status: 400,
      code: 'MISSING_VERIFICATION_TOKEN',
      error: 'Security verification token is required. Please complete the verification challenge.',
    });

    const req = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
    });

    const res = await loginRoute(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('MISSING_VERIFICATION_TOKEN');
    expect(body.error).toContain('Security verification token is required');
  });

  // ---------------------------------------------------------------------------
  // 2. Invalid verification token
  // ---------------------------------------------------------------------------
  it('2. Rejects login with HTTP 400 when verification token is invalid or rejected by provider', async () => {
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: false,
      status: 400,
      code: 'INVALID_VERIFICATION_TOKEN',
      error: 'Security verification failed. Please complete the verification challenge.',
    });

    const req = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
      verificationToken: 'bad-or-expired-token-xyz',
    });

    const res = await loginRoute(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.code).toBe('INVALID_VERIFICATION_TOKEN');
    expect(body.error).toContain('Security verification failed');
  });

  // ---------------------------------------------------------------------------
  // 3. Verification provider timeout
  // ---------------------------------------------------------------------------
  it('3. Responds with HTTP 503 when verification provider times out', async () => {
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: false,
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Security verification service is temporarily unavailable. Please try again shortly.',
    });

    const req = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
      verificationToken: 'token-causing-timeout',
    });

    const res = await loginRoute(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error).toContain('Security verification service is temporarily unavailable');
  });

  // ---------------------------------------------------------------------------
  // 4. Verification provider unavailable
  // ---------------------------------------------------------------------------
  it('4. Responds with HTTP 503 when verification provider is unreachable or 5xx', async () => {
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: false,
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Security verification service is temporarily unavailable. Please try again shortly.',
    });

    const req = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
      verificationToken: 'token-when-provider-down',
    });

    const res = await loginRoute(req);
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.code).toBe('SERVICE_UNAVAILABLE');
  });

  // ---------------------------------------------------------------------------
  // 5. Incorrect credentials (after valid verification)
  // ---------------------------------------------------------------------------
  it('5. Rejects with HTTP 401 when verification succeeds but credentials are incorrect', async () => {
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: true,
      status: 200,
    });

    const req = createLoginRequest({
      email: mockUser.email,
      password: 'WRONG_PASSWORD_XYZ',
      verificationToken: 'valid-turnstile-token-1234',
    });

    const res = await loginRoute(req);
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toContain('Invalid credentials');
  });

  // ---------------------------------------------------------------------------
  // 6. Valid login with successful verification
  // ---------------------------------------------------------------------------
  it('6. Successfully authenticates with HTTP 200 and session cookie on valid credentials and token', async () => {
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: true,
      status: 200,
    });

    const req = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
      verificationToken: 'valid-turnstile-token-1234',
    });

    const res = await loginRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.user.email).toBe(mockUser.email);
    expect(res.cookies.get(authModule.COOKIE_NAME)).toBeDefined();
  });

  // ---------------------------------------------------------------------------
  // 7. Successful login after verification recovery
  // ---------------------------------------------------------------------------
  it('7. Handles verification recovery: first attempt fails provider, second attempt succeeds and logs in', async () => {
    // Attempt 1: Provider is temporarily down
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: false,
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Security verification service is temporarily unavailable. Please try again shortly.',
    });

    const req1 = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
      verificationToken: 'initial-stale-token',
    });

    const res1 = await loginRoute(req1);
    expect(res1.status).toBe(503);

    // Attempt 2 (Recovery): Provider recovered, fresh token issued, login succeeds
    vi.spyOn(securityVerificationModule, 'verifySecurityToken').mockResolvedValueOnce({
      success: true,
      status: 200,
    });

    const req2 = createLoginRequest({
      email: mockUser.email,
      password: 'StarkValidPassword2026!',
      verificationToken: 'freshly-recovered-token-5678',
    });

    const res2 = await loginRoute(req2);
    const body2 = await res2.json();

    expect(res2.status).toBe(200);
    expect(body2.success).toBe(true);
    expect(body2.user.email).toBe(mockUser.email);
    expect(res2.cookies.get(authModule.COOKIE_NAME)).toBeDefined();
  });
});
