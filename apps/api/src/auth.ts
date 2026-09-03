import { createHmac, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { hash, verify } from '@node-rs/argon2';
import postgres from 'postgres';

export type AuthUser = Readonly<{ id: string; email: string }>;

export interface AuthStore {
  createUser(email: string, passwordHash: string): Promise<AuthUser | undefined>;
  findUserByEmail(email: string): Promise<(AuthUser & { passwordHash: string }) | undefined>;
  createSession(userId: string, tokenHash: string, expiresAt: Date): Promise<void>;
  findUserBySession(tokenHash: string, now: Date): Promise<AuthUser | undefined>;
  deleteSession(tokenHash: string): Promise<void>;
  close(): Promise<void>;
}

export const sessionCookieName = 'pinjamakun_session';
export const sessionLifetimeSeconds = 60 * 60 * 24 * 30;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function digestSessionToken(token: string, secret: string): string {
  return createHmac('sha256', secret).update(token).digest('hex');
}

export async function hashPassword(password: string): Promise<string> {
  return hash(password, { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1 });
}

export async function verifyPassword(passwordHash: string, password: string): Promise<boolean> {
  try {
    return await verify(passwordHash, password);
  } catch {
    return false;
  }
}

export function constantTimeTokenMatch(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export function createPostgresAuthStore(databaseUrl: string): AuthStore {
  const sql = postgres(databaseUrl, { max: 10, idle_timeout: 20, connect_timeout: 10 });

  return {
    async createUser(email, passwordHash) {
      const id = randomUUID();
      const rows = await sql<AuthUser[]>`
        insert into users (id, email, password_hash)
        values (${id}, ${email}, ${passwordHash})
        on conflict (email) do nothing
        returning id, email
      `;
      return rows[0];
    },
    async findUserByEmail(email) {
      const rows = await sql<(AuthUser & { passwordHash: string })[]>`
        select id, email, password_hash as "passwordHash"
        from users where email = ${email} limit 1
      `;
      return rows[0];
    },
    async createSession(userId, tokenHash, expiresAt) {
      await sql`
        insert into auth_sessions (token_hash, user_id, expires_at)
        values (${tokenHash}, ${userId}, ${expiresAt})
      `;
    },
    async findUserBySession(tokenHash, now) {
      const rows = await sql<AuthUser[]>`
        select users.id, users.email
        from auth_sessions
        join users on users.id = auth_sessions.user_id
        where auth_sessions.token_hash = ${tokenHash}
          and auth_sessions.expires_at > ${now}
        limit 1
      `;
      return rows[0];
    },
    async deleteSession(tokenHash) {
      await sql`delete from auth_sessions where token_hash = ${tokenHash}`;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}
