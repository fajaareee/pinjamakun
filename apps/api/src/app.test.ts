import { afterEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';

const app = buildApp({ logger: false });
afterEach(async () => {
  await app.close();
});

describe('health route', () => {
  it('reports service readiness', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', service: 'pinjamakun-api' });
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['x-content-type-options']).toBe('nosniff');
  });
});
