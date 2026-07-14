import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
  isSameOriginRequest,
  requestAdminAuthApi,
} from '@/services/admin-auth.server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const ACTIONS = new Set(['suspend', 'reactivate']);
const SESSION_INVALIDATING_CODES = new Set([
  'ADMIN_SESSION_INVALID',
  'ADMIN_SESSION_EXPIRED',
  'ADMIN_ACCESS_REQUIRED',
  'DELETION_REQUEST_ACTIVE',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
]);
const MAX_BODY_BYTES = 16 * 1024;

const validateSegments = (segments, method) => {
  if (segments.length === 0) return ['GET', 'POST'].includes(method);
  if (segments.length === 1 && UUID_PATTERN.test(segments[0])) {
    return ['GET', 'PATCH'].includes(method);
  }
  return (
    segments.length === 2
    && UUID_PATTERN.test(segments[0])
    && ACTIONS.has(segments[1])
    && method === 'POST'
  );
};

const readBody = async (request) => {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return { error: 'PAYLOAD_TOO_LARGE' };
  }
  try {
    return { body: await request.json() };
  } catch {
    return { error: 'INVALID_JSON' };
  }
};

const forward = async (request, context, method) => {
  const { segments = [] } = await context.params;
  if (!validateSegments(segments, method)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Admin user route not found.' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  if (method !== 'GET' && !isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: { code: 'ORIGIN_REQUIRED', message: 'Yêu cầu không cùng nguồn.' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  let body;
  if (method !== 'GET') {
    const parsed = await readBody(request);
    if (parsed.error) {
      const status = parsed.error === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
      return NextResponse.json(
        { error: { code: parsed.error, message: 'Dữ liệu yêu cầu không hợp lệ.' } },
        { status, headers: { 'Cache-Control': 'no-store' } },
      );
    }
    body = parsed.body;
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || '';
  const suffix = segments.length > 0 ? `/${segments.join('/')}` : '';
  const query = method === 'GET' ? request.nextUrl.search : '';
  const result = await requestAdminAuthApi(`/admin-web/users${suffix}${query}`, {
    method,
    sessionToken,
    body,
  });

  const response = result.body === null
    ? new NextResponse(null, { status: result.status, headers: { 'Cache-Control': 'no-store' } })
    : NextResponse.json(result.body, {
      status: result.status,
      headers: { 'Cache-Control': 'no-store' },
    });
  if (SESSION_INVALIDATING_CODES.has(result.body?.error?.code)) {
    response.cookies.set(ADMIN_SESSION_COOKIE, '', getExpiredSessionCookieOptions());
  }
  return response;
};

export const GET = (request, context) => forward(request, context, 'GET');
export const POST = (request, context) => forward(request, context, 'POST');
export const PATCH = (request, context) => forward(request, context, 'PATCH');
