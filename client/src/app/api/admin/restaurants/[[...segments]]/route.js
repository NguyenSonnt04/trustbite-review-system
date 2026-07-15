import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getExpiredSessionCookieOptions,
  isSameOriginRequest,
  requestAdminAuthApi,
} from '@/services/admin-auth.server';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const SESSION_INVALIDATING_CODES = new Set([
  'ADMIN_SESSION_INVALID',
  'ADMIN_SESSION_EXPIRED',
  'ADMIN_ACCESS_REQUIRED',
  'DELETION_REQUEST_ACTIVE',
  'ACCOUNT_SUSPENDED',
  'ACCOUNT_DELETED',
]);
const MAX_JSON_BYTES = 32 * 1024;
const MAX_MULTIPART_BYTES = 6 * 1024 * 1024;

const validateSegments = (segments, method) => {
  if (segments.length === 0) return method === 'GET';
  if (segments.length === 1 && UUID_PATTERN.test(segments[0])) {
    return ['GET', 'PATCH'].includes(method);
  }
  if (
    segments.length === 2
    && UUID_PATTERN.test(segments[0])
    && segments[1] === 'images'
  ) {
    return method === 'POST';
  }
  if (
    segments.length === 3
    && UUID_PATTERN.test(segments[0])
    && segments[1] === 'images'
    && UUID_PATTERN.test(segments[2])
  ) {
    return ['PATCH', 'DELETE'].includes(method);
  }
  return (
    segments.length === 4
    && UUID_PATTERN.test(segments[0])
    && segments[1] === 'images'
    && UUID_PATTERN.test(segments[2])
    && segments[3] === 'replace'
    && method === 'POST'
  );
};

const readBoundedBytes = async (request, maxBytes) => {
  const reader = request.body?.getReader();
  if (!reader) return { bytes: new Uint8Array() };

  const chunks = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      return { error: 'PAYLOAD_TOO_LARGE' };
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { bytes };
};

const readRequestBody = async (request, method) => {
  if (['GET', 'DELETE'].includes(method)) return {};
  const contentType = request.headers.get('content-type') || '';
  const isMultipart = contentType.toLowerCase().startsWith('multipart/form-data;');
  const maxBytes = isMultipart ? MAX_MULTIPART_BYTES : MAX_JSON_BYTES;
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) return { error: 'PAYLOAD_TOO_LARGE' };

  try {
    const streamed = await readBoundedBytes(request, maxBytes);
    if (streamed.error) return streamed;
    if (isMultipart) {
      return { rawBody: streamed.bytes, contentType };
    }
    return { body: JSON.parse(new TextDecoder().decode(streamed.bytes)) };
  } catch {
    return { error: 'INVALID_BODY' };
  }
};

const forward = async (request, context, method) => {
  const { segments = [] } = await context.params;
  if (!validateSegments(segments, method)) {
    return NextResponse.json(
      { error: { code: 'NOT_FOUND', message: 'Admin restaurant route not found.' } },
      { status: 404, headers: { 'Cache-Control': 'no-store' } },
    );
  }
  if (method !== 'GET' && !isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: { code: 'ORIGIN_REQUIRED', message: 'Yêu cầu không cùng nguồn.' } },
      { status: 403, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const parsed = await readRequestBody(request, method);
  if (parsed.error) {
    const status = parsed.error === 'PAYLOAD_TOO_LARGE' ? 413 : 400;
    return NextResponse.json(
      { error: { code: parsed.error, message: 'Dữ liệu yêu cầu không hợp lệ.' } },
      { status, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const cookieStore = await cookies();
  const sessionToken = cookieStore.get(ADMIN_SESSION_COOKIE)?.value || '';
  const suffix = segments.length > 0 ? `/${segments.join('/')}` : '';
  const query = method === 'GET' ? request.nextUrl.search : '';
  const idempotencyKey = request.headers.get('idempotency-key');
  const result = await requestAdminAuthApi(`/admin-web/restaurants${suffix}${query}`, {
    method,
    sessionToken,
    body: parsed.body,
    rawBody: parsed.rawBody,
    contentType: parsed.contentType,
    extraHeaders: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {},
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
export const DELETE = (request, context) => forward(request, context, 'DELETE');
