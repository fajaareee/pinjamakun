import { describe, expect, it } from 'vitest';
import { readApiEnvironment } from './index.js';

describe('readApiEnvironment', () => {
  const requiredEnvironment = {
    DATABASE_URL: 'postgresql://localhost/pinjamakun',
    AUTH_SECRET: 'test-secret',
    PUBLIC_APP_URL: 'http://localhost:5173',
  };

  it('uses safe development network defaults', () => {
    expect(readApiEnvironment(requiredEnvironment)).toEqual({
      nodeEnvironment: 'development',
      host: '127.0.0.1',
      port: 3000,
      databaseUrl: requiredEnvironment.DATABASE_URL,
      authSecret: requiredEnvironment.AUTH_SECRET,
      publicAppUrl: requiredEnvironment.PUBLIC_APP_URL,
    });
  });

  it('rejects public production binding', () => {
    expect(() =>
      readApiEnvironment({ ...requiredEnvironment, NODE_ENV: 'production', API_HOST: '0.0.0.0' }),
    ).toThrow('API_HOST must bind to loopback in production');
  });

  it('rejects invalid ports', () => {
    expect(() => readApiEnvironment({ ...requiredEnvironment, API_PORT: '3000oops' })).toThrow(
      'API_PORT must be an integer between 1 and 65535',
    );
  });

  it('requires authentication configuration', () => {
    expect(() => readApiEnvironment({})).toThrow('Missing environment: DATABASE_URL');
  });
});
