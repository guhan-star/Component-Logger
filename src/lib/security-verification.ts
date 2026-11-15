/**
 * Stark Industries WMC — Security Verification Provider Integration
 *
 * Implements Cloudflare Turnstile / Bot Protection for critical authentication flows.
 *
 * Security Requirements:
 * - Validates frontend verification tokens against the provider siteverify API.
 * - Enforces token presence and validity in production environments.
 * - Consistent frontend (NEXT_PUBLIC_TURNSTILE_SITE_KEY) and backend (TURNSTILE_SECRET_KEY) key management.
 * - Resilient timeout handling (4000ms AbortSignal) and provider error recovery.
 * - Returns standardized status codes:
 *   - 400: Missing or invalid verification tokens (client action required)
 *   - 503: Provider unavailable or request timeout (server/service issue)
 * - Safe mock bypasses for development and test suites without exposing secrets.
 */

export interface SecurityVerificationResult {
  success: boolean;
  status: 200 | 400 | 503;
  code?: 'MISSING_VERIFICATION_TOKEN' | 'INVALID_VERIFICATION_TOKEN' | 'SERVICE_UNAVAILABLE';
  error?: string;
  provider?: string;
  errorCodes?: string[];
}

export interface SecurityVerificationOptions {
  isSensitive?: boolean;
}

const DEFAULT_TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const VERIFY_TIMEOUT_MS = 4000;

/**
 * Checks whether security verification (Turnstile) is enabled/configured.
 */
export function isSecurityVerificationConfigured(): boolean {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  return Boolean(secret || siteKey);
}

/**
 * Validates consistent key configuration between frontend and backend.
 */
export function validateVerificationKeys(): { valid: boolean; error?: string } {
  const secret = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();

  if (siteKey && !secret) {
    return {
      valid: false,
      error: 'Backend TURNSTILE_SECRET_KEY is missing while frontend NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured.',
    };
  }

  if (secret && !siteKey) {
    return {
      valid: false,
      error: 'Frontend NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing while backend TURNSTILE_SECRET_KEY is configured.',
    };
  }

  return { valid: true };
}

/**
 * Validates a security verification token with Cloudflare Turnstile.
 */
export async function verifySecurityToken(
  token: string | null | undefined,
  clientIp?: string,
  options: SecurityVerificationOptions = { isSensitive: true }
): Promise<SecurityVerificationResult> {
  const isProduction =
    process.env.NODE_ENV === 'production' &&
    process.env.TEST_MODE !== 'true' &&
    process.env.ALLOW_LOCAL_FALLBACK !== 'true';

  const secretKey = process.env.TURNSTILE_SECRET_KEY?.trim();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const verifyUrl = process.env.TURNSTILE_VERIFY_URL?.trim() || DEFAULT_TURNSTILE_VERIFY_URL;
  const isEnforced = isProduction || Boolean(secretKey || siteKey) || process.env.REQUIRE_SECURITY_VERIFICATION === 'true';

  // 1. Simulation and mock handles for automated tests & local development
  if (process.env.TEST_MODE === 'true' || process.env.NODE_ENV === 'test') {
    if (token === 'timeout') {
      return {
        success: false,
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Security verification service is temporarily unavailable. Please try again shortly.',
        provider: 'Cloudflare Turnstile',
      };
    }

    if (token === 'unavailable') {
      return {
        success: false,
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Security verification service is temporarily unavailable. Please try again shortly.',
        provider: 'Cloudflare Turnstile',
      };
    }

    if (token === 'invalid_token' || token === 'fail' || token === 'invalid') {
      return {
        success: false,
        status: 400,
        code: 'INVALID_VERIFICATION_TOKEN',
        error: 'Security verification failed. Please complete the verification challenge.',
        provider: 'Cloudflare Turnstile',
      };
    }

    if (!token && isEnforced) {
      return {
        success: false,
        status: 400,
        code: 'MISSING_VERIFICATION_TOKEN',
        error: 'Security verification token is required. Please complete the verification challenge.',
        provider: 'Cloudflare Turnstile',
      };
    }

    // Default test success when valid token passed
    return { success: true, status: 200, provider: 'Cloudflare Turnstile' };
  }

  // 2. Production consistency and key presence check
  const keyValidation = validateVerificationKeys();
  if (!keyValidation.valid) {
    console.error(`[SecurityVerification CRITICAL] Key inconsistency: ${keyValidation.error}`);
    return {
      success: false,
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Security verification service is temporarily unavailable. Please try again shortly.',
      provider: 'Cloudflare Turnstile',
    };
  }

  // If not configured and not strictly enforced, allow bypass with warning
  if (!secretKey) {
    if (isProduction && (process.env.REQUIRE_SECURITY_VERIFICATION === 'true' || siteKey)) {
      console.error(
        '[SecurityVerification CRITICAL] TURNSTILE_SECRET_KEY is required but not configured in production environment variables. Failing closed.'
      );
      return {
        success: false,
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Security verification service is temporarily unavailable. Please try again shortly.',
        provider: 'Cloudflare Turnstile',
      };
    }

    if (isProduction) {
      console.warn(
        '[SecurityVerification WARNING] Turnstile keys not configured in environment variables. Proceeding with credential authentication and server-side rate limiting.'
      );
    }

    // When keys are unconfigured, allow authentication to proceed
    return { success: true, status: 200, provider: 'None (Unconfigured)' };
  }

  // 3. Token presence check
  const cleanToken = token?.trim();
  if (!cleanToken) {
    return {
      success: false,
      status: 400,
      code: 'MISSING_VERIFICATION_TOKEN',
      error: 'Security verification token is required. Please complete the verification challenge.',
      provider: 'Cloudflare Turnstile',
    };
  }

  // 4. Remote validation against Cloudflare Turnstile API
  try {
    const formData = new URLSearchParams();
    formData.append('secret', secretKey);
    formData.append('response', cleanToken);
    if (clientIp) {
      formData.append('remoteip', clientIp);
    }

    const response = await fetch(verifyUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
      signal: AbortSignal.timeout(VERIFY_TIMEOUT_MS),
    });

    if (!response.ok) {
      console.error(`[SecurityVerification] Provider returned HTTP ${response.status}`);
      return {
        success: false,
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        error: 'Security verification service is temporarily unavailable. Please try again shortly.',
        provider: 'Cloudflare Turnstile',
      };
    }

    const data = await response.json();

    if (data.success === true) {
      return {
        success: true,
        status: 200,
        provider: 'Cloudflare Turnstile',
      };
    }

    console.warn('[SecurityVerification] Token verification rejected by provider:', data['error-codes'] || []);
    return {
      success: false,
      status: 400,
      code: 'INVALID_VERIFICATION_TOKEN',
      error: 'Security verification failed. Please complete the verification challenge.',
      provider: 'Cloudflare Turnstile',
      errorCodes: data['error-codes'],
    };
  } catch (err: any) {
    const isTimeout = err?.name === 'TimeoutError' || err?.name === 'AbortError' || err?.message?.includes('timeout');
    console.error(`[SecurityVerification ERROR] Provider request failed (${isTimeout ? 'Timeout' : 'Network'}):`, err?.message || err);

    return {
      success: false,
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      error: 'Security verification service is temporarily unavailable. Please try again shortly.',
      provider: 'Cloudflare Turnstile',
    };
  }
}
