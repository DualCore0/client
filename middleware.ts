import { NextResponse, type NextRequest } from 'next/server';

const TOKEN_COOKIE = 'classrank_token';

/** Routes that require a signed-in user. */
const PROTECTED_PREFIXES = [
  '/dashboard',
  '/rooms',
  '/tests',
  '/profile',
  '/leaderboard',
  '/join',
];

/** Routes a signed-in user should be bounced away from. */
const AUTH_ROUTES = ['/login', '/signup'];

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const hasSession = Boolean(request.cookies.get(TOKEN_COOKIE)?.value);

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isProtected && !hasSession) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return NextResponse.redirect(url);
  }

  if (hasSession && AUTH_ROUTES.some((route) => pathname === route)) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/rooms/:path*',
    '/tests/:path*',
    '/profile/:path*',
    '/leaderboard/:path*',
    '/join/:path*',
    '/login',
    '/signup',
  ],
};
