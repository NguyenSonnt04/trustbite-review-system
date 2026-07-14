import { NextResponse } from 'next/server';

const ADMIN_SESSION_COOKIE = 'trustbite_admin_session';

export function middleware(request) {
  const hasAdminSession = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!hasAdminSession) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
