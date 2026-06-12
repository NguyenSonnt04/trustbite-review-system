import { describe, expect, it } from 'vitest';
import { requestApp } from '../helpers/http.js';

describe('health route integration smoke', () => {
  it('returns ok without opening a network listener', async () => {
    const response = await requestApp()
      .get('/health')
      .expect(200);

    expect(response.body).toEqual({ status: 'ok' });
  });
});
