const AUTH_TOKEN_KEY = 'auth_token';
const USER_STORAGE_KEY = 'user';

const getBrowserStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
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
}

export const authService = new AuthService();
