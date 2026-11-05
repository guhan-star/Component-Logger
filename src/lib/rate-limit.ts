/**
 * Stark Industries WMC — Distributed Production Rate Limiting
 *
 * Implements atomic distributed rate limiting powered by Upstash Redis REST API.
 * 
 * Production Security Rules:
 * - In production (NODE_ENV === 'production'):
 *   - Strictly requires shared distributed Redis (Upstash).
 *   - Never silently falls back to process-local in-memory storage.
 *   - Sensitive endpoints (auth, registration, recovery, invitations, abuse-prone routes)
 *     fail closed with HTTP 503 Service Unavailable if Upstash is unconfigured or unreachable.
 * - In development & test environments:
 *   - Allows controlled in-memory sliding window fallback for developer convenience and test runners.
 */

import { NextResponse } from 'next/server';

export interface RateLimitOptions {
  windowMs: number;     // Window duration in milliseconds (e.g. 60_000 for 1 minute)
  max: number;          // Maximum allowed requests within the window
  isSensitive?: boolean; // If true, fails closed (503) in production when Redis is unreachable
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  retryAfter: number;
  isDistributed: boolean;
  isServiceUnavailable?: boolean;
}

// In-memory fallback ONLY for local development and automated testing
interface MemoryRecord {
  count: number;
  resetTime: number;
}
const testMemoryStore = new Map<string, MemoryRecord>();

// Clean up expired local test entries periodically
if (typeof setInterval !== 'undefined') {
  const cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of testMemoryStore.entries()) {
      if (now > record.resetTime) {
        testMemoryStore.delete(key);
      }
    }
  }, 60 * 1000);
  if (cleanupTimer.unref) {
    cleanupTimer.unref();
  }
}

/**
 * Reset memory store (used by test suites)
 */
export function _resetMemoryStoreForTesting(): void {
  testMemoryStore.clear();
}

/**
 * Standard Rate Limit Policies across the application
 */
export const RATE_LIMIT_POLICIES = {
  // Sensitive Authentication & Recovery (Fail Closed)
  LOGIN: { windowMs: 60 * 1000, max: 10, isSensitive: true },                 // 10 / min
  REGISTER: { windowMs: 15 * 60 * 1000, max: 5, isSensitive: true },           // 5 / 15 min
  FORGOT_PASSWORD: { windowMs: 15 * 60 * 1000, max: 3, isSensitive: true },    // 3 / 15 min
  RESET_PASSWORD: { windowMs: 15 * 60 * 1000, max: 5, isSensitive: true },     // 5 / 15 min
  VERIFY_EMAIL_REQUEST: { windowMs: 15 * 60 * 1000, max: 3, isSensitive: true }, // 3 / 15 min
  VERIFY_EMAIL_SUBMIT: { windowMs: 15 * 60 * 1000, max: 10, isSensitive: true }, // 10 / 15 min
  
  // Abuse-Prone Collaboration & Uploads
  USERNAME_DISCOVERY: { windowMs: 60 * 1000, max: 30, isSensitive: true },    // 30 / min
  FRIEND_REQUESTS: { windowMs: 10 * 60 * 1000, max: 10, isSensitive: true },   // 10 / 10 min
  PROJECT_INVITATIONS: { windowMs: 10 * 60 * 1000, max: 10, isSensitive: true }, // 10 / 10 min
  AI_PROCESSING: { windowMs: 5 * 60 * 1000, max: 10, isSensitive: true },      // 10 / 5 min
  FILE_UPLOADS: { windowMs: 10 * 60 * 1000, max: 20, isSensitive: true },      // 20 / 10 min
  
  // General API Guard
  DEFAULT_API: { windowMs: 60 * 1000, max: 60, isSensitive: false },           // 60 / min
} as const;

/**
 * Checks rate limit for a given identifier (e.g. action:ip or action:user_id).
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = RATE_LIMIT_POLICIES.DEFAULT_API
): Promise<RateLimitResult> {
  const isProduction = process.env.NODE_ENV === 'production' && process.env.TEST_MODE !== 'true' && process.env.ALLOW_LOCAL_FALLBACK !== 'true';
  const isSensitive = options.isSensitive !== false;
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const redisKey = `stark_rl:${identifier}`;

  const redisUrl = process.env.UPSTASH_REDIS_REST_URL?.trim();
  const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN?.trim();

  // 1. Attempt Upstash Redis Distributed Rate Limiting
  if (redisUrl && redisToken) {
    try {
      const response = await fetch(`${redisUrl}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${redisToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, windowSeconds, 'NX'],
          ['TTL', redisKey],
        ]),
        signal: AbortSignal.timeout(3000), // 3s timeout
      });

      if (response.ok) {
        const results = await response.json();
        const currentCount = Number(results?.[0]?.result) || 1;
        const ttl = Number(results?.[2]?.result) || windowSeconds;
        const retryAfter = Math.max(1, ttl);
        const resetTime = Date.now() + retryAfter * 1000;
        const remaining = Math.max(0, options.max - currentCount);

        return {
          success: currentCount <= options.max,
          limit: options.max,
          remaining,
          resetTime,
          retryAfter,
          isDistributed: true,
        };
      } else {
        console.error(`[RateLimit] Upstash pipeline returned HTTP ${response.status}`);
      }
    } catch (err: any) {
      console.error('[RateLimit] Upstash connection error:', err?.message || 'Network error');
    }
  }

  // 2. Production fail-closed behavior for unconfigured/unreachable Upstash
  if (isProduction) {
    if (isSensitive) {
      console.error(
        `[RateLimit CRITICAL] Rate limiter unavailable in production for sensitive key "${identifier}". Failing closed.`
      );
      return {
        success: false,
        limit: options.max,
        remaining: 0,
        resetTime: Date.now() + options.windowMs,
        retryAfter: windowSeconds,
        isDistributed: false,
        isServiceUnavailable: true,
      };
    } else {
      // Non-sensitive routes may allow temporary degraded throughput with a logged warning
      console.warn(
        `[RateLimit WARNING] Upstash Redis unconfigured in production for non-sensitive key "${identifier}".`
      );
      return {
        success: true,
        limit: options.max,
        remaining: 1,
        resetTime: Date.now() + options.windowMs,
        retryAfter: 0,
        isDistributed: false,
      };
    }
  }

  // 3. Development / Test environment in-memory sliding window fallback
  const now = Date.now();
  const record = testMemoryStore.get(identifier);

  if (!record || now > record.resetTime) {
    const newRecord: MemoryRecord = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    testMemoryStore.set(identifier, newRecord);
    return {
      success: true,
      limit: options.max,
      remaining: options.max - 1,
      resetTime: newRecord.resetTime,
      retryAfter: windowSeconds,
      isDistributed: false,
    };
  }

  if (record.count >= options.max) {
    const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      resetTime: record.resetTime,
      retryAfter,
      isDistributed: false,
    };
  }

  record.count += 1;
  const remaining = Math.max(0, options.max - record.count);
  const retryAfter = Math.max(1, Math.ceil((record.resetTime - now) / 1000));

  return {
    success: true,
    limit: options.max,
    remaining,
    resetTime: record.resetTime,
    retryAfter,
    isDistributed: false,
  };
}

/**
 * Creates a standardized HTTP 429 or HTTP 503 response based on rate limit check results.
 */
export function rateLimitResponse(result: RateLimitResult): NextResponse {
  if (result.isServiceUnavailable) {
    return NextResponse.json(
      {
        error: 'Security verification service is temporarily unavailable. Please try again shortly.',
        code: 'SERVICE_UNAVAILABLE',
        retryAfter: result.retryAfter,
      },
      {
        status: 503,
        headers: {
          'Retry-After': String(result.retryAfter || 30),
        },
      }
    );
  }

  return NextResponse.json(
    {
      error: `Too many requests. Please wait ${result.retryAfter} seconds before trying again.`,
      code: 'RATE_LIMIT_EXCEEDED',
      limit: result.limit,
      remaining: result.remaining,
      retryAfter: result.retryAfter,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(result.retryAfter),
        'X-RateLimit-Limit': String(result.limit),
        'X-RateLimit-Remaining': String(result.remaining),
        'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
      },
    }
  );
}

/**
 * Reliable client IP extraction prioritizing Vercel and trusted proxy headers.
 */
export function getClientIp(request: Request): string {
  // 1. Vercel deployment header
  const vercelIp = request.headers.get('x-vercel-forwarded-for');
  if (vercelIp) {
    return vercelIp.split(',')[0].trim();
  }

  // 2. Cloudflare header
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp.trim();
  }

  // 3. Standard x-forwarded-for
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    const clientIp = forwarded.split(',')[0].trim();
    if (clientIp) return clientIp;
  }

  // 4. Standard x-real-ip
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return '127.0.0.1';
}
