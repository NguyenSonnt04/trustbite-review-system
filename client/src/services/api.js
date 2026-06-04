import config from '@/config/config';
import { authService } from './auth.service';

/**
 * Enterprise API client wrapper.
 * Automatically injects authorization token and handles errors.
 */
class ApiClient {
  constructor() {
    this.baseUrl = config.apiUrl;
  }

  async request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const token = authService.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...options.headers,
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const configOptions = {
      ...options,
      headers,
    };

    try {
      const response = await fetch(url, configOptions);

      // Handle token expiration or unauthorized
      if (response.status === 401) {
        authService.logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        throw new Error('Session expired. Please login again.');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      // Check if response is empty (e.g. 204 No Content)
      if (response.status === 204) {
        return null;
      }

      return await response.json();
    } catch (error) {
      console.error(`API Request failed for: ${path}`, error);
      throw error;
    }
  }

  get(path, options = {}) {
    return this.request(path, { ...options, method: 'GET' });
  }

  post(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  put(path, body, options = {}) {
    return this.request(path, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body),
    });
  }

  delete(path, options = {}) {
    return this.request(path, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient();
