import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  verifySecurityToken,
  validateVerificationKeys,
  isSecurityVerificationConfigured,
} from '@/lib/security-verification';

describe('Unit Tests: Security Verification Provider (Cloudflare Turnstile)', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('detects when security verification keys are configured or unconfigured', () => {
    delete process.env.TURNSTILE_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    expect(isSecurityVerificationConfigured()).toBe(false);

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    expect(isSecurityVerificationConfigured()).toBe(true);
  });

  it('validates key consistency between frontend site key and backend secret key', () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    delete process.env.TURNSTILE_SECRET_KEY;
    const missingSecret = validateVerificationKeys();
    expect(missingSecret.valid).toBe(false);
    expect(missingSecret.error).toContain('Backend TURNSTILE_SECRET_KEY is missing');

    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    const missingSiteKey = validateVerificationKeys();
    expect(missingSiteKey.valid).toBe(false);
    expect(missingSiteKey.error).toContain('Frontend NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing');

    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';
    const consistent = validateVerificationKeys();
    expect(consistent.valid).toBe(true);
  });

  it('fails closed with HTTP 503 when backend secret is missing in production for sensitive flows', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_LOCAL_FALLBACK;
    delete process.env.TURNSTILE_SECRET_KEY;

    const result = await verifySecurityToken('some-token', '1.2.3.4');
    expect(result.success).toBe(false);
    expect(result.status).toBe(503);
    expect(result.code).toBe('SERVICE_UNAVAILABLE');
    expect(result.error).toContain('Security verification service is temporarily unavailable');
  });

  it('rejects missing or empty verification tokens with HTTP 400', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_LOCAL_FALLBACK;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

    const resultNull = await verifySecurityToken(null, '1.2.3.4');
    expect(resultNull.success).toBe(false);
    expect(resultNull.status).toBe(400);
    expect(resultNull.code).toBe('MISSING_VERIFICATION_TOKEN');

    const resultEmpty = await verifySecurityToken('   ', '1.2.3.4');
    expect(resultEmpty.success).toBe(false);
    expect(resultEmpty.status).toBe(400);
    expect(resultEmpty.code).toBe('MISSING_VERIFICATION_TOKEN');
  });

  it('rejects invalid verification tokens with HTTP 400 when provider returns success: false', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_LOCAL_FALLBACK;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: false,
        'error-codes': ['invalid-input-response'],
      }),
    } as any);

    const result = await verifySecurityToken('fake-invalid-token', '1.2.3.4');
    expect(result.success).toBe(false);
    expect(result.status).toBe(400);
    expect(result.code).toBe('INVALID_VERIFICATION_TOKEN');
    expect(result.error).toContain('Security verification failed');
  });

  it('handles provider timeout gracefully with HTTP 503', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_LOCAL_FALLBACK;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

    const timeoutErr = new Error('The operation was aborted due to timeout');
    timeoutErr.name = 'TimeoutError';
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(timeoutErr);

    const result = await verifySecurityToken('valid-token-format', '1.2.3.4');
    expect(result.success).toBe(false);
    expect(result.status).toBe(503);
    expect(result.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('handles provider 5xx outages gracefully with HTTP 503', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_LOCAL_FALLBACK;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: async () => ({ error: 'Bad Gateway' }),
    } as any);

    const result = await verifySecurityToken('valid-token-format', '1.2.3.4');
    expect(result.success).toBe(false);
    expect(result.status).toBe(503);
    expect(result.code).toBe('SERVICE_UNAVAILABLE');
  });

  it('accepts valid verification tokens when provider returns success: true', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_LOCAL_FALLBACK;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = '1x00000000000000000000AA';
    process.env.TURNSTILE_SECRET_KEY = '1x0000000000000000000000000000000AA';

    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({
        success: true,
        challenge_ts: new Date().toISOString(),
        hostname: 'component-logger.vercel.app',
      }),
    } as any);

    const result = await verifySecurityToken('valid-turnstile-token-12345', '1.2.3.4');
    expect(result.success).toBe(true);
    expect(result.status).toBe(200);
  });
});
