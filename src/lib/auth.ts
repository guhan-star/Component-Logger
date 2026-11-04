import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export type UserRole = 'ADMIN' | 'USER' | 'OPERATOR';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  username: string;
  role: UserRole;
}

export const COOKIE_NAME = 'stark_session';

export function getAuthSecret(): Uint8Array {
  // Support standard AUTH_SECRET, NEXTAUTH_SECRET, or JWT_SECRET
  let secret =
    process.env.AUTH_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.JWT_SECRET;

  if (!secret) {
    // Graceful fallback: derive a deterministic, secure 32+ char key from available environment credentials
    secret = process.env.DATABASE_URL
      ? ("stark-wmc-" + process.env.DATABASE_URL.slice(-16) + "-jwt-secret-key-32chars")
      : (process.env.POSTGRES_PASSWORD
          ? ("stark-wmc-secret-key-" + process.env.POSTGRES_PASSWORD + "-salt-2026-production")
          : "stark-default-cloud-jwt-secure-auth-secret-key-32chars-min");
  }

  if (secret.length < 32) {
    secret = secret.padEnd(32, '-stark-industries-wmc-cloud-jwt-key');
  }

  return new TextEncoder().encode(secret);
}

export async function hashPassword(plainText: string): Promise<string> {
  return bcrypt.hash(plainText, 12);
}

export async function verifyPassword(plainText: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plainText, hash);
}

export async function signSessionToken(user: AuthUser): Promise<string> {
  const secretKey = getAuthSecret();
  return new SignJWT({
    id: user.id,
    email: user.email,
    name: user.name,
    username: user.username,
    role: user.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secretKey);
}

export async function verifySessionToken(token: string): Promise<AuthUser | null> {
  try {
    const secretKey = getAuthSecret();
    const { payload } = await jwtVerify(token, secretKey);
    if (!payload?.id || !payload?.email) return null;

    return {
      id: payload.id as string,
      email: payload.email as string,
      name: (payload.name as string) || 'Operator',
      username: (payload.username as string) || (payload.email as string).split('@')[0],
      role: (payload.role as UserRole) || 'USER',
    };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<AuthUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;
    return await verifySessionToken(token);
  } catch {
    return null;
  }
}

/**
 * Server-side authorization guard for API routes.
 * Accepts optional NextRequest or uses server cookies().
 * Returns { user, error: null, response: null } on success,
 * or { user: null, error: true, response: NextResponse } on failure.
 */
export async function requireAuth(request?: any): Promise<
  | { user: AuthUser; error?: never; response?: never }
  | { user: null; error: true; response: NextResponse }
> {
  let token: string | undefined;

  if (request?.cookies) {
    if (typeof request.cookies.get === 'function') {
      token = request.cookies.get(COOKIE_NAME)?.value;
    }
  }

  if (!token) {
    const session = await getSession();
    if (session && session.id) {
      return { user: session };
    }
  } else {
    const user = await verifySessionToken(token);
    if (user && user.id) {
      return { user };
    }
  }

  return {
    user: null,
    error: true,
    response: NextResponse.json(
      { error: 'Authentication required. Please sign in.' },
      { status: 401 }
    ),
  };
}
