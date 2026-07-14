import config from '@/config/config';

const API_PREFIX = '/api/v1';

const normalizeApiBaseUrl = (apiUrl) => {
  const baseUrl = apiUrl.replace(/\/+$/u, '');
  const pathname = new URL(baseUrl, 'http://trustbite.local').pathname.replace(/\/+$/u, '');
  return pathname === API_PREFIX ? baseUrl : `${baseUrl}${API_PREFIX}`;
};

const readErrorMessage = async (response) => {
  const body = await response.json().catch(() => null);
  return body?.error?.message || body?.message || `HTTP error! status: ${response.status}`;
};

class ApiClient {
  constructor() {
    this.baseUrl = normalizeApiBaseUrl(config.apiUrl);
  }

  async request(path, options = {}) {
    if (!path.startsWith('/')) {
      throw new Error('API path must start with /');
    }

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers
    };

    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers
    });

    if (response.status === 401) {
      throw new Error('Yêu cầu xác thực không hợp lệ.');
    }

    if (!response.ok) {
      throw new Error(await readErrorMessage(response));
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  patch(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
