const AUTH_TOKEN_KEY = 'auth_token';
const USER_STORAGE_KEY = 'user';

const getBrowserStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

class AuthService {
  async login() {
    throw new Error('Cognito client login is not implemented in this web slice');
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
}

export const authService = new AuthService();
