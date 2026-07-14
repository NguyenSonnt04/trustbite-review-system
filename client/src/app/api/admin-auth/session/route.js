import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
  requestAdminAuthApi,
} from '@/services/admin-auth.server';

export async function GET() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || '';
  const result = await requestAdminAuthApi('/auth/admin/web-session', {
    sessionToken,
  });

  if (!result.ok) {
    const response = NextResponse.json(
      {
        error: {
          code: result.body?.error?.code || 'ADMIN_SESSION_INVALID',
          message: 'Phiên quản trị không còn hợp lệ.',
        },
      },
      {
        status: result.status,
        headers: { 'Cache-Control': 'no-store' },
      },
    );
    if ([401, 403, 409].includes(result.status)) {
      response.cookies.set(
        ADMIN_SESSION_COOKIE,
        '',
        getExpiredSessionCookieOptions(),
      );
    }
    return response;
  }

  return NextResponse.json(result.body, {
    headers: { 'Cache-Control': 'no-store' },
  });
}
