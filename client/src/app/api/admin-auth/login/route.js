import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  getSessionCookieOptions,
  isSameOriginRequest,
  requestAdminAuthApi,
} from '@/services/admin-auth.server';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
};
const MAX_LOGIN_BODY_BYTES = 4096;
const HEADER_NAME_PATTERN = /^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/u;
const CREDENTIAL_REJECTION_CODES = new Set([
  'ACCOUNT_DELETED',
  'ACCOUNT_SUSPENDED',
  'ADMIN_ACCESS_REQUIRED',
  'ADMIN_SESSION_INVALID',
  'DELETION_REQUEST_ACTIVE',
  'INVALID_CREDENTIALS',
  'UNMAPPED_IDENTITY',
]);

const getClientAddress = (request) => {
  const trustedHeader = process.env.ADMIN_WEB_TRUSTED_CLIENT_IP_HEADER?.trim().toLowerCase();
  if (!trustedHeader || !HEADER_NAME_PATTERN.test(trustedHeader)) {
    return null;
  }
  const value = request.headers.get(trustedHeader)?.split(',')[0]?.trim() || '';
  return isIP(value) > 0 ? value : null;
};

const readBoundedJson = async (request) => {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json')) {
    return { error: 'UNSUPPORTED_MEDIA_TYPE' };
  }

  const reader = request.body?.getReader();
  if (!reader) {
    return { error: 'INVALID_JSON' };
  }

  const decoder = new TextDecoder();
  let size = 0;
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_LOGIN_BODY_BYTES) {
      await reader.cancel();
      return { error: 'PAYLOAD_TOO_LARGE' };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return { value: JSON.parse(text) };
  } catch {
    return { error: 'INVALID_JSON' };
  }
};

const getSafeErrorMessage = (status, code) => {
  if (status === 422) return 'Vui lòng nhập email và mật khẩu hợp lệ.';
  if (status === 429) return 'Có quá nhiều lần đăng nhập. Vui lòng thử lại sau.';
  if (code === 'AUTH_CHALLENGE_REQUIRED') {
    return 'Tài khoản cần hoàn tất bước xác thực bổ sung trước khi đăng nhập web.';
  }
  if (code === 'PASSWORD_RESET_REQUIRED') {
    return 'Tài khoản cần đặt lại mật khẩu trước khi đăng nhập.';
  }
  if (status >= 500) return 'Dịch vụ đăng nhập đang tạm thời gián đoạn.';
  return 'Email, mật khẩu hoặc quyền quản trị không hợp lệ.';
};

export async function POST(request) {
  if (!isSameOriginRequest(request)) {
    return NextResponse.json(
      { error: { code: 'ORIGIN_NOT_ALLOWED', message: 'Yêu cầu đăng nhập không hợp lệ.' } },
      { status: 403, headers: noStoreHeaders },
    );
  }

  const clientAddress = getClientAddress(request);
  if (process.env.NODE_ENV === 'production' && !clientAddress) {
    return NextResponse.json(
      { error: { code: 'AUTH_NOT_CONFIGURED', message: 'Dịch vụ đăng nhập đang tạm thời gián đoạn.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const contentLength = Number.parseInt(request.headers.get('content-length') || '0', 10);
  if (Number.isFinite(contentLength) && contentLength > MAX_LOGIN_BODY_BYTES) {
    return NextResponse.json(
      { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Yêu cầu đăng nhập không hợp lệ.' } },
      { status: 413, headers: noStoreHeaders },
    );
  }

  const parsed = await readBoundedJson(request);
  if (parsed.error === 'UNSUPPORTED_MEDIA_TYPE') {
    return NextResponse.json(
      { error: { code: parsed.error, message: 'Yêu cầu đăng nhập không hợp lệ.' } },
      { status: 415, headers: noStoreHeaders },
    );
  }
  if (parsed.error === 'PAYLOAD_TOO_LARGE') {
    return NextResponse.json(
      { error: { code: parsed.error, message: 'Yêu cầu đăng nhập không hợp lệ.' } },
      { status: 413, headers: noStoreHeaders },
    );
  }
  if (parsed.error) {
    return NextResponse.json(
      { error: { code: 'INVALID_JSON', message: 'Yêu cầu đăng nhập không hợp lệ.' } },
      { status: 400, headers: noStoreHeaders },
    );
  }
  const body = parsed.value;

  const result = await requestAdminAuthApi('/auth/admin/web-session', {
    method: 'POST',
    clientAddress,
    body: {
      email: body?.email,
      password: body?.password,
    },
  });
  if (!result.ok) {
    const internalCode = result.body?.error?.code || 'LOGIN_FAILED';
    const isCredentialRejection = CREDENTIAL_REJECTION_CODES.has(internalCode);
    const code = isCredentialRejection ? 'INVALID_CREDENTIALS' : internalCode;
    const status = isCredentialRejection ? 401 : result.status;
    return NextResponse.json(
      { error: { code, message: getSafeErrorMessage(status, code) } },
      { status, headers: noStoreHeaders },
    );
  }

  const sessionToken = result.body?.sessionToken;
  const expiresAt = result.body?.expiresAt;
  const expiry = new Date(expiresAt);
  if (
    typeof sessionToken !== 'string'
    || !Number.isFinite(expiry.getTime())
    || expiry.getTime() <= Date.now()
  ) {
    return NextResponse.json(
      { error: { code: 'AUTH_SERVICE_INVALID_RESPONSE', message: 'Dịch vụ đăng nhập đang tạm thời gián đoạn.' } },
      { status: 503, headers: noStoreHeaders },
    );
  }

  const response = NextResponse.json({
    expiresAt,
    user: result.body.user,
  }, {
    status: 200,
    headers: noStoreHeaders,
  });
  response.cookies.set(
    ADMIN_SESSION_COOKIE,
    sessionToken,
    getSessionCookieOptions(expiresAt),
  );
  return response;
}
