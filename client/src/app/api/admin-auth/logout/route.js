import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
  isSameOriginRequest,
  requestAdminAuthApi,
} from '@/services/admin-auth.server';

export async function DELETE(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Yêu cầu đăng xuất không hợp lệ.' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || '';
  if (sessionToken) {
    const result = await requestAdminAuthApi('/auth/admin/web-session', {
      method: 'DELETE',
      sessionToken,
    });
    if (!result.ok) {
      return NextResponse.json(
        {
          error: {
            code: 'LOGOUT_FAILED',
            message: 'Không thể thu hồi phiên quản trị. Vui lòng thử lại.',
          },
        },
        { status: 503, headers: { 'Cache-Control': 'no-store' } },
      );
    }
  }

  const response = new NextResponse(null, {
    status: 204,
    headers: { 'Cache-Control': 'no-store' },
  });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    '',
    getExpiredSessionCookieOptions(),
  );
  return response;
}
