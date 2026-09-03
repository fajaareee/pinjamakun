import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app.js';
import { digestSessionToken, hashPassword } from './auth.js';
import type { AuthStore, AuthUser } from './auth.js';

let app = buildApp({ logger: false });
beforeEach(() => {
  app = buildApp({ logger: false });
});
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

class MemoryAuthStore implements AuthStore {
  readonly users = new Map<string, AuthUser & { passwordHash: string }>();
  readonly sessions = new Map<string, { userId: string; expiresAt: Date }>();

  createUser(email: string, passwordHash: string): Promise<AuthUser | undefined> {
    if (this.users.has(email)) return Promise.resolve(undefined);
    const user = { id: crypto.randomUUID(), email, passwordHash };
    this.users.set(email, user);
    return Promise.resolve({ id: user.id, email: user.email });
  }
  findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | undefined> {
    return Promise.resolve(this.users.get(email));
  }
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void> {
    this.sessions.set(tokenHash, { userId, expiresAt });
    return Promise.resolve();
  }
  findUserBySession(tokenHash: string, now: Date): Promise<AuthUser | undefined> {
    const session = this.sessions.get(tokenHash);
    if (!session || session.expiresAt <= now) return Promise.resolve(undefined);
    const user = [...this.users.values()].find((candidate) => candidate.id === session.userId);
    return Promise.resolve(user ? { id: user.id, email: user.email } : undefined);
  }
  deleteSession(tokenHash: string): Promise<void> {
    this.sessions.delete(tokenHash);
    return Promise.resolve();
  }
  async close() {
    return Promise.resolve();
  }
}

describe('authentication routes', () => {
  const origin = 'https://acc.example.com';
  const secret = 'test-secret-that-is-long-enough-for-tests';

  beforeEach(() => {
    app = buildApp({
      logger: false,
      authStore: new MemoryAuthStore(),
      authSecret: secret,
      publicAppUrl: origin,
    });
  });

  it('registers a user and restores the session', async () => {
    const registration = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin },
      payload: { email: 'User@Example.com', password: 'a-secure-password' },
    });
    expect(registration.statusCode).toBe(201);
    expect(registration.json()).toMatchObject({ user: { email: 'user@example.com' } });
    const cookie = registration.headers['set-cookie'];
    expect(cookie).toContain('HttpOnly');
    expect(cookie).toContain('SameSite=Strict');

    const currentUser = await app.inject({ method: 'GET', url: '/auth/me', headers: { cookie } });
    expect(currentUser.statusCode).toBe(200);
    expect(currentUser.json()).toMatchObject({ user: { email: 'user@example.com' } });
  });

  it('rejects invalid credentials without exposing which field failed', async () => {
    const store = new MemoryAuthStore();
    await store.createUser('user@example.com', await hashPassword('correct-password'));
    await app.close();
    app = buildApp({ logger: false, authStore: store, authSecret: secret, publicAppUrl: origin });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/login',
      headers: { origin },
      payload: { email: 'user@example.com', password: 'wrong-password' },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'Email atau password salah.' });
  });

  it('rejects cross-origin mutations', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/auth/register',
      headers: { origin: 'https://attacker.example' },
      payload: { email: 'user@example.com', password: 'a-secure-password' },
    });
    expect(response.statusCode).toBe(400);
  });

  it('logs out idempotently and clears the session', async () => {
    const store = new MemoryAuthStore();
    const user = await store.createUser('user@example.com', await hashPassword('correct-password'));
    const token = 'test-session-token';
    await store.createSession(
      user!.id,
      digestSessionToken(token, secret),
      new Date(Date.now() + 60_000),
    );
    await app.close();
    app = buildApp({ logger: false, authStore: store, authSecret: secret, publicAppUrl: origin });
    const response = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      headers: { origin, cookie: `pinjamakun_session=${token}` },
    });
    expect(response.statusCode).toBe(204);
    expect(response.headers['set-cookie']).toContain('Max-Age=0');
    expect(store.sessions.size).toBe(0);
  });
});
