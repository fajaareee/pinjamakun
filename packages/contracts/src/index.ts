import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const HealthResponseSchema = Type.Object({
  status: Type.Literal('ok'),
  service: Type.Literal('pinjamakun-api'),
  timestamp: Type.String({ format: 'date-time' }),
});
export type HealthResponse = Static<typeof HealthResponseSchema>;

export const AuthUserSchema = Type.Object({
  id: Type.String({ format: 'uuid' }),
  email: Type.String({ format: 'email' }),
});
export type AuthUser = Static<typeof AuthUserSchema>;

export const AuthCredentialsSchema = Type.Object(
  {
    email: Type.String({ format: 'email', maxLength: 320 }),
    password: Type.String({ minLength: 12, maxLength: 128 }),
  },
  { additionalProperties: false },
);
export type AuthCredentials = Static<typeof AuthCredentialsSchema>;

export const AuthResponseSchema = Type.Object({ user: AuthUserSchema });
export type AuthResponse = Static<typeof AuthResponseSchema>;

export const AuthErrorSchema = Type.Object({
  error: Type.String(),
});
export type AuthError = Static<typeof AuthErrorSchema>;

export const PortableCookieSchema = Type.Object({
  name: Type.String({ minLength: 1 }),
  value: Type.String(),
  domain: Type.String({ minLength: 1 }),
  hostOnly: Type.Boolean(),
  path: Type.String({ pattern: '^/' }),
  secure: Type.Boolean(),
  httpOnly: Type.Boolean(),
  sameSite: Type.Union([
    Type.Literal('strict'),
    Type.Literal('lax'),
    Type.Literal('none'),
    Type.Literal('unspecified'),
  ]),
  expirationDate: Type.Optional(Type.Number({ minimum: 0 })),
});
export type PortableCookie = Static<typeof PortableCookieSchema>;

export const EncryptedSnapshotSchema = Type.Object({
  protocolVersion: Type.Literal(1),
  snapshotId: Type.String({ format: 'uuid' }),
  domain: Type.String({ minLength: 1 }),
  createdAt: Type.String({ format: 'date-time' }),
  expiresAt: Type.String({ format: 'date-time' }),
  nonce: Type.String({ minLength: 1 }),
  ciphertext: Type.String({ minLength: 1 }),
});
export type EncryptedSnapshot = Static<typeof EncryptedSnapshotSchema>;
