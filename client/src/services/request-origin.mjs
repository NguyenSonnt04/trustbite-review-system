const parseExactOrigin = (value) => {
  if (typeof value !== 'string' || !value.trim()) return '';

  const candidate = value.trim();
  try {
    const parsed = new URL(candidate);
    return parsed.origin === candidate ? parsed.origin : '';
  } catch {
    return '';
  }
};

const parseRequestOrigin = (requestUrl) => {
  try {
    return new URL(requestUrl).origin;
  } catch {
    return '';
  }
};

export const isAllowedRequestOrigin = ({
  originHeader,
  publicOrigin,
  requestUrl,
  production,
}) => {
  const receivedOrigin = parseExactOrigin(originHeader);
  if (!receivedOrigin) return false;

  const configuredOrigin = parseExactOrigin(publicOrigin);
  if (production) {
    return configuredOrigin.startsWith('https://') && receivedOrigin === configuredOrigin;
  }

  if (publicOrigin && !configuredOrigin) return false;
  const expectedOrigin = configuredOrigin || parseRequestOrigin(requestUrl);
  return Boolean(expectedOrigin) && receivedOrigin === expectedOrigin;
};

export const isSameOriginRequest = (request) => isAllowedRequestOrigin({
  originHeader: request.headers.get('origin'),
  publicOrigin: process.env.ADMIN_WEB_PUBLIC_ORIGIN || '',
  requestUrl: request.url,
  production: process.env.NODE_ENV === 'production',
});
