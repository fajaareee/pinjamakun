import { Type } from '@sinclair/typebox';
import type { Static } from '@sinclair/typebox';

export const HealthResponseSchema = Type.Object({
  status: Type.Literal('ok'),
  service: Type.Literal('pinjamakun-api'),
  timestamp: Type.String({ format: 'date-time' }),
});
export type HealthResponse = Static<typeof HealthResponseSchema>;

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
