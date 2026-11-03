/**
 * Stark Industries WMC — Distributed & In-Memory Rate Limiting
 * Supports Upstash Redis REST API for serverless distributed multi-region rate limiting.
 * Falls back safely to in-memory sliding window when unconfigured, with explicit `isDistributed` reporting.
 */

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const memoryStore = new Map<string, RateLimitRecord>();

// Clean up expired local entries periodically
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, record] of memoryStore.entries()) {
      if (now > record.resetTime) {
        memoryStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
  if (timer.unref) {
    timer.unref();
  }
}

export interface RateLimitOptions {
  windowMs: number; // e.g. 60_000 for 1 minute
  max: number;      // max allowed hits within window
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetTime: number;
  isDistributed: boolean;
}

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

/**
 * Checks rate limit for a given identifier (e.g. IP + Action).
 * Uses Upstash Redis if configured; otherwise uses server-side in-memory store.
 */
export async function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = { windowMs: 60_000, max: 10 }
): Promise<RateLimitResult> {
  const windowSeconds = Math.max(1, Math.ceil(options.windowMs / 1000));
  const redisKey = `rate-limit:${identifier}`;

  // 1. Try distributed Upstash Redis if configured
  if (UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN) {
    try {
      const response = await fetch(`${UPSTASH_REDIS_REST_URL}/pipeline`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify([
          ['INCR', redisKey],
          ['EXPIRE', redisKey, windowSeconds, 'NX'],
          ['TTL', redisKey],
        ]),
        // Short timeout so slow network doesn't hang requests
        signal: AbortSignal.timeout(2000),
      });

      if (response.ok) {
        const results = await response.json();
        // results is an array like [{ result: count }, { result: 1 }, { result: ttl }]
        const currentCount = Number(results?.[0]?.result) || 1;
        const ttl = Number(results?.[2]?.result) || windowSeconds;
        const resetTime = Date.now() + Math.max(1, ttl) * 1000;
        const remaining = Math.max(0, options.max - currentCount);

        return {
          success: currentCount <= options.max,
          limit: options.max,
          remaining,
          resetTime,
          isDistributed: true,
        };
      }
    } catch (err) {
      console.warn('⚠️ Upstash rate limit connection failed, falling back to local memory store:', err);
    }
  }

  // 2. In-memory fallback
  const now = Date.now();
  const record = memoryStore.get(identifier);

  if (!record || now > record.resetTime) {
    const newRecord: RateLimitRecord = {
      count: 1,
      resetTime: now + options.windowMs,
    };
    memoryStore.set(identifier, newRecord);
    return {
      success: true,
      limit: options.max,
      remaining: options.max - 1,
      resetTime: newRecord.resetTime,
      isDistributed: false,
    };
  }

  if (record.count >= options.max) {
    return {
      success: false,
      limit: options.max,
      remaining: 0,
      resetTime: record.resetTime,
      isDistributed: false,
    };
  }

  record.count += 1;
  return {
    success: true,
    limit: options.max,
    remaining: options.max - record.count,
    resetTime: record.resetTime,
    isDistributed: false,
  };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  return '127.0.0.1';
}
