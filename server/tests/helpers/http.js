import './env.js';
import request from 'supertest';
import app from '../../src/app.js';

export function requestApp() {
  return request(app);
}
