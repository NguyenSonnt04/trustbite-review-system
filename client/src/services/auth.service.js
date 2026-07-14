class AuthService {
  async login({ email, password } = {}) {
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
    await fetch('/api/admin-auth/logout', {
      method: 'DELETE',
    });
  }
}

export const authService = new AuthService();
