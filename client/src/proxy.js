import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
  requestAdminAuthApi,
} from '@/services/admin-auth.server';

const redirectToLogin = (request, reason, { clearCookie = false } = {}) => {
  const loginUrl = new URL('/', request.url);
  loginUrl.searchParams.set('reason', reason);
  const response = NextResponse.redirect(loginUrl);
  response.headers.set('Cache-Control', 'no-store');
  if (clearCookie) {
    response.cookies.set(
      ADMIN_SESSION_COOKIE,
      '',
      getExpiredSessionCookieOptions(),
    );
  }
  return response;
};

export async function proxy(request) {
  const sessionToken = request.cookies.get(ADMIN_SESSION_COOKIE)?.value || '';
  if (!sessionToken) {
    return redirectToLogin(request, 'session_required');
  }

  const result = await requestAdminAuthApi('/auth/admin/web-session', {
    sessionToken,
  });
  if (!result.ok) {
    const invalidSession = [401, 403, 409].includes(result.status);
    return redirectToLogin(
      request,
      invalidSession ? 'session_expired' : 'auth_unavailable',
      { clearCookie: invalidSession },
    );
  }

  const response = NextResponse.next();
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

export const config = {
  matcher: ['/admin', '/admin/:path*'],
};
