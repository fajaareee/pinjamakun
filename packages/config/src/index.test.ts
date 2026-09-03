import { describe, expect, it } from 'vitest';
import { readApiEnvironment } from './index.js';

describe('readApiEnvironment', () => {
  it('uses safe development defaults', () => {
    expect(readApiEnvironment({})).toEqual({
      nodeEnvironment: 'development',
      host: '127.0.0.1',
      port: 3000,
    });
  });

  it('rejects public production binding', () => {
    expect(() => readApiEnvironment({ NODE_ENV: 'production', API_HOST: '0.0.0.0' })).toThrow(
      'API_HOST must bind to loopback in production',
    );
  });

  it('rejects invalid ports', () => {
    expect(() => readApiEnvironment({ API_PORT: '3000oops' })).toThrow(
      'API_PORT must be an integer between 1 and 65535',
    );
  });
});
