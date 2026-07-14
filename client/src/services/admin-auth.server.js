import 'server-only';

export const ADMIN_SESSION_COOKIE = 'trustbite_admin_session';

const normalizeApiBaseUrl = (apiUrl) => {
  const baseUrl = apiUrl.replace(/\/+$/u, '');
  const pathname = new URL(baseUrl, 'http://trustbite.local').pathname.replace(/\/+$/u, '');
  return pathname === '/api/v1' ? baseUrl : `${baseUrl}/api/v1`;
};

const getConfiguration = () => ({
  apiBaseUrl: normalizeApiBaseUrl(
    process.env.TRUSTBITE_SERVER_API_URL
      || process.env.NEXT_PUBLIC_API_URL
      || 'http://localhost:5000',
  ),
  bffSecret: process.env.ADMIN_WEB_BFF_SECRET || '',
});

export const getSessionCookieOptions = (expiresAt) => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires: new Date(expiresAt),
  priority: 'high',
});

export const getExpiredSessionCookieOptions = () => ({
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  expires: new Date(0),
  priority: 'high',
});

export const isSameOriginRequest = (request) => {
  const origin = request.headers.get('origin');
  if (!origin) {
    return false;
  }

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
};

export const requestAdminAuthApi = async (path, {
  method = 'GET',
  sessionToken = '',
  clientAddress = '',
  body,
  rawBody,
  contentType = '',
  extraHeaders = {},
} = {}) => {
  const { apiBaseUrl, bffSecret } = getConfiguration();
  if (!bffSecret) {
    return {
      ok: false,
      status: 503,
      body: {
        error: {
          code: 'AUTH_NOT_CONFIGURED',
          message: 'Admin authentication is not configured',
        },
      },
    };
  }

  const headers = {
    Accept: 'application/json',
    'x-trustbite-bff-secret': bffSecret,
    ...extraHeaders,
  };
  if (sessionToken) {
    headers['x-trustbite-admin-session'] = sessionToken;
  }
  if (clientAddress) {
    headers['x-trustbite-client-address'] = clientAddress;
  }
  if (rawBody !== undefined && contentType) {
    headers['Content-Type'] = contentType;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${apiBaseUrl}${path}`, {
      method,
      headers,
      body: rawBody !== undefined
        ? rawBody
        : body === undefined
          ? undefined
          : JSON.stringify(body),
      cache: 'no-store',
      signal: AbortSignal.timeout(rawBody !== undefined ? 15000 : 5000),
    });
  } catch {
    return {
      ok: false,
      status: 503,
      body: {
        error: {
          code: 'AUTH_SERVICE_UNAVAILABLE',
          message: 'Admin authentication is temporarily unavailable',
        },
      },
    };
  }

  const responseBody = response.status === 204
    ? null
    : await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    body: responseBody,
  };
};
