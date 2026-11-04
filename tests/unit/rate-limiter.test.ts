import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  checkRateLimit,
  rateLimitResponse,
  getClientIp,
  _resetMemoryStoreForTesting,
  RATE_LIMIT_POLICIES,
} from '@/lib/rate-limit';

describe('Unit Tests: Rate Limiter', () => {
  beforeEach(() => {
    _resetMemoryStoreForTesting();
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('allows requests within threshold and decrements remaining quota', async () => {
    const key = 'test-client-1';
    const policy = { windowMs: 60_000, max: 3, isSensitive: false };

    const res1 = await checkRateLimit(key, policy);
    expect(res1.success).toBe(true);
    expect(res1.remaining).toBe(2);

    const res2 = await checkRateLimit(key, policy);
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(1);

    const res3 = await checkRateLimit(key, policy);
    expect(res3.success).toBe(true);
    expect(res3.remaining).toBe(0);

    const res4 = await checkRateLimit(key, policy);
    expect(res4.success).toBe(false);
    expect(res4.remaining).toBe(0);
    expect(res4.retryAfter).toBeGreaterThan(0);
  });

  it('generates standard HTTP 429 response when rate limit exceeded', () => {
    const result = {
      success: false,
      limit: 10,
      remaining: 0,
      resetTime: Date.now() + 45_000,
      retryAfter: 45,
      isDistributed: false,
    };

    const response = rateLimitResponse(result);
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('45');
    expect(response.headers.get('X-RateLimit-Limit')).toBe('10');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  });

  it('fails closed with HTTP 503 in production when Upstash Redis is missing for sensitive routes', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    try {
      // Sensitive endpoint (e.g. login, register, forgot-password)
      const res = await checkRateLimit('prod-login:127.0.0.1', RATE_LIMIT_POLICIES.LOGIN);

      expect(res.success).toBe(false);
      expect(res.isServiceUnavailable).toBe(true);

      const httpRes = rateLimitResponse(res);
      expect(httpRes.status).toBe(503);

      const json = await httpRes.json();
      expect(json.code).toBe('SERVICE_UNAVAILABLE');
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('handles simulated Upstash Redis REST pipeline response accurately', async () => {
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash-redis.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-secret-token';

    // Mock fetch to simulate Upstash pipeline response
    vi.spyOn(global, 'fetch').mockImplementationOnce(async () => {
      return {
        ok: true,
        status: 200,
        json: async () => [{ result: 2 }, { result: 1 }, { result: 58 }],
      } as any;
    });

    const res = await checkRateLimit('pipeline-test:127.0.0.1', { windowMs: 60_000, max: 10 });
    expect(res.success).toBe(true);
    expect(res.isDistributed).toBe(true);
    expect(res.remaining).toBe(8); // max 10 - count 2 = 8
    expect(res.retryAfter).toBe(58);
  });

  it('fails closed when Upstash pipeline errors out in production', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    process.env.UPSTASH_REDIS_REST_URL = 'https://mock-upstash-redis.com';
    process.env.UPSTASH_REDIS_REST_TOKEN = 'mock-secret-token';

    vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Connection timed out'));

    try {
      const res = await checkRateLimit('fail-test:127.0.0.1', RATE_LIMIT_POLICIES.LOGIN);
      expect(res.success).toBe(false);
      expect(res.isServiceUnavailable).toBe(true);
    } finally {
      process.env.NODE_ENV = originalEnv;
    }
  });

  it('reliably extracts client IP from Vercel, Cloudflare, and proxy headers', () => {
    // Vercel header
    const reqVercel = new Request('http://localhost/api/test', {
      headers: { 'x-vercel-forwarded-for': '203.0.113.195, 10.0.0.1' },
    });
    expect(getClientIp(reqVercel)).toBe('203.0.113.195');

    // Cloudflare header
    const reqCf = new Request('http://localhost/api/test', {
      headers: { 'cf-connecting-ip': '198.51.100.44' },
    });
    expect(getClientIp(reqCf)).toBe('198.51.100.44');

    // Standard X-Forwarded-For
    const reqFwd = new Request('http://localhost/api/test', {
      headers: { 'x-forwarded-for': '192.0.2.1, 10.0.0.2' },
    });
    expect(getClientIp(reqFwd)).toBe('192.0.2.1');

    // Real IP
    const reqReal = new Request('http://localhost/api/test', {
      headers: { 'x-real-ip': '192.0.2.55' },
    });
    expect(getClientIp(reqReal)).toBe('192.0.2.55');

    // Fallback
    const reqNone = new Request('http://localhost/api/test');
    expect(getClientIp(reqNone)).toBe('127.0.0.1');
  });
});
