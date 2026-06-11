const AUTH_TOKEN_KEY = 'auth_token';
const USER_STORAGE_KEY = 'user';

const getBrowserStorage = () => {
  if (typeof window === 'undefined') {
    return null;
  }

  return window.localStorage;
};

class AuthService {
  logout() {
    const storage = getBrowserStorage();
    if (!storage) {
      return;
    }

    storage.removeItem(AUTH_TOKEN_KEY);
    storage.removeItem(USER_STORAGE_KEY);
  }

  getToken() {
    return getBrowserStorage()?.getItem(AUTH_TOKEN_KEY) ?? null;
  }
}

export const authService = new AuthService();
