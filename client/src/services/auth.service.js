const AUTH_TOKEN_KEY = 'auth_token';
const USER_STORAGE_KEY = 'user';
const ADMIN_SESSION_COOKIE = 'trustbite_admin_session';

const getBrowserStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

const writeAdminSessionCookie = (token) => {
  if (typeof document === 'undefined') {
    return;
  }

  const secure = window.location.protocol === 'https:' ? '; Secure' : '';
  document.cookie = `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/admin; SameSite=Lax${secure}`;
};

const clearAdminSessionCookie = () => {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${ADMIN_SESSION_COOKIE}=; Path=/admin; Max-Age=0; SameSite=Lax`;
};

class AuthService {
  async login({ email, password } = {}) {
    if (!email || !password) {
      throw new Error('Vui lòng nhập email và mật khẩu quản trị.');
    }

    throw new Error('Đăng nhập quản trị bằng Cognito chưa được kết nối trong bản web này.');
  }

  async register() {
    throw new Error('Cognito client registration is not implemented in this web slice');
  }

  logout() {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }

    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(USER_STORAGE_KEY);
    clearAdminSessionCookie();
  }

  getCurrentUser() {
    const userJson = getBrowserStorage()?.getItem(USER_STORAGE_KEY);
    if (!userJson) {
      return null;
    }

    try {
      return JSON.parse(userJson);
    } catch {
      return null;
    }
  }

  getToken() {
    return getBrowserStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
  }

  hasAdminSession() {
    const token = this.getToken();
    const user = this.getCurrentUser();
    const roles = Array.isArray(user?.roles) ? user.roles : [];
    return Boolean(token) && roles.some((role) => ['ADMIN', 'SUPER_ADMIN'].includes(String(role).toUpperCase()));
  }

  persistAuthenticatedSession({ token, user }) {
    if (!token || !user) {
      throw new Error('Authenticated sessions require a token and user.');
    }

    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }

    storage.setItem(AUTH_TOKEN_KEY, token);
    storage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    writeAdminSessionCookie(token);
  }
}

export const authService = new AuthService();
export { ADMIN_SESSION_COOKIE };
