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
    await requestAdminAuthApi('/auth/admin/web-session', {
      method: 'DELETE',
      sessionToken,
    });
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
