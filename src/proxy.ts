import { NextResponse, type NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { COOKIE_NAME, getAuthSecret } from '@/lib/auth';

async function isValidSession(request: NextRequest): Promise<boolean> {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const secretKey = getAuthSecret();
    const { payload } = await jwtVerify(token, secretKey);
    return !!payload?.id;
  } catch {
    return false;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasAuth = await isValidSession(request);

  // If already authenticated and trying to visit login/register, redirect to inventory
  if (hasAuth && (pathname === '/login' || pathname === '/register')) {
    return NextResponse.redirect(new URL('/components', request.url));
  }

  // If unauthenticated and on login/register, let through
  if (pathname === '/login' || pathname === '/register') {
    return NextResponse.next();
  }

  // If unauthenticated and visiting any protected route, redirect to /login
  if (!hasAuth) {
    const loginUrl = new URL('/login', request.url);
    if (pathname !== '/' && pathname !== '/components') {
      loginUrl.searchParams.set('next', pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/',
    '/components/:path*',
    '/loans/:path*',
    '/projects/:path*',
    '/purchase-list/:path*',
    '/identify/:path*',
    '/receipt-review/:path*',
    '/settings/:path*',
    '/import-export/:path*',
    '/friends/:path*',
    '/login',
    '/register',
  ],
};
