import config from '@/config/config';

const AUTH_TOKEN_KEY = 'auth_token';
const USER_STORAGE_KEY = 'user';
const OAUTH_STATE_KEY = 'oauth_state';
const OAUTH_VERIFIER_KEY = 'oauth_code_verifier';
const OAUTH_RETURN_TO_KEY = 'oauth_return_to';

const getBrowserStorage = () => {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage;
};

class AuthService {
  async login(credentialsOrReturnTo = {}) {
    if (typeof credentialsOrReturnTo === 'string') {
      return this.beginHostedLogin(credentialsOrReturnTo);
    }

    const { email, password } = credentialsOrReturnTo;
    if (!email || !password) {
      throw new Error('Vui lòng nhập email và mật khẩu quản trị.');
    }

    const response = await fetch('/api/admin-auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message || 'Không thể đăng nhập vào lúc này.');
    }
    return body;
  }

  async beginHostedLogin(returnTo = '/') {
    const storage = getBrowserStorage();
    const { clientId, domain, redirectUri } = config.aws.cognito;
    if (!storage || !clientId || !domain || !redirectUri) {
      throw new Error('Cognito Hosted UI is not configured.');
    }

    const state = this.randomBase64Url(32);
    const verifier = this.randomBase64Url(64);
    const challenge = await this.sha256Base64Url(verifier);
    storage.setItem(OAUTH_STATE_KEY, state);
    storage.setItem(OAUTH_VERIFIER_KEY, verifier);
    storage.setItem(OAUTH_RETURN_TO_KEY, returnTo);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: 'openid email phone profile',
      state,
      code_challenge_method: 'S256',
      code_challenge: challenge,
    });
    window.location.assign(`${domain.replace(/\/+$/u, '')}/oauth2/authorize?${params.toString()}`);
  }

  async completeLogin({ code, state }) {
    const storage = getBrowserStorage();
    const { clientId, domain, redirectUri } = config.aws.cognito;
    const expectedState = storage?.getItem(OAUTH_STATE_KEY);
    const verifier = storage?.getItem(OAUTH_VERIFIER_KEY);
    if (!storage || !code || !state || state !== expectedState || !verifier) {
      throw new Error('The sign-in response could not be verified.');
    }

    const response = await fetch(`${domain.replace(/\/+$/u, '')}/oauth2/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: clientId,
        code,
        redirect_uri: redirectUri,
        code_verifier: verifier,
      }),
    });
    if (!response.ok) {
      throw new Error('Cognito did not complete the sign-in request.');
    }

    const tokens = await response.json();
    if (!tokens.access_token) {
      throw new Error('Cognito did not return an access token.');
    }
    storage.setItem(AUTH_TOKEN_KEY, tokens.access_token);
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(this.decodeJwt(tokens.id_token) ?? {}));
    const returnTo = storage.getItem(OAUTH_RETURN_TO_KEY) || '/';
    storage.removeItem(OAUTH_STATE_KEY);
    storage.removeItem(OAUTH_VERIFIER_KEY);
    storage.removeItem(OAUTH_RETURN_TO_KEY);
    return returnTo;
  }

  async register(returnTo = '/') {
    return this.beginHostedLogin(returnTo);
  }

  async getSession() {
    const response = await fetch('/api/admin-auth/session', {
      cache: 'no-store',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message || 'Phiên quản trị không còn hợp lệ.');
    }
    return body;
  }

  async logout() {
    const storage = getBrowserStorage();
    const merchantToken = storage?.getItem(AUTH_TOKEN_KEY);
    storage?.removeItem(AUTH_TOKEN_KEY);
    storage?.removeItem(USER_STORAGE_KEY);
    storage?.removeItem(OAUTH_STATE_KEY);
    storage?.removeItem(OAUTH_VERIFIER_KEY);
    storage?.removeItem(OAUTH_RETURN_TO_KEY);
    if (merchantToken) return;

    const response = await fetch('/api/admin-auth/logout', {
      method: 'DELETE',
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(body?.error?.message || 'Không thể đăng xuất an toàn.');
    }
  }

  getToken() {
    return getBrowserStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
  }

  randomBase64Url(byteLength) {
    const bytes = new Uint8Array(byteLength);
    window.crypto.getRandomValues(bytes);
    return this.base64Url(bytes);
  }

  async sha256Base64Url(value) {
    const digest = await window.crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(value),
    );
    return this.base64Url(new Uint8Array(digest));
  }

  base64Url(bytes) {
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return window.btoa(binary)
      .replace(/\+/gu, '-')
      .replace(/\//gu, '_')
      .replace(/=+$/gu, '');
  }

  decodeJwt(token) {
    if (!token) return null;
    try {
      const normalized = token.split('.')[1]
        .replace(/-/gu, '+')
        .replace(/_/gu, '/');
      const payload = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
      return JSON.parse(window.atob(payload));
    } catch {
      return null;
    }
  }
}

export const authService = new AuthService();
