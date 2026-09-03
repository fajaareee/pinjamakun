import Fastify from 'fastify';
import type { FastifyReply } from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import {
  AuthCredentialsSchema,
  AuthErrorSchema,
  AuthResponseSchema,
  HealthResponseSchema,
} from '@pinjamakun/contracts';
import {
  createSessionToken,
  digestSessionToken,
  hashPassword,
  normalizeEmail,
  sessionCookieName,
  sessionLifetimeSeconds,
  verifyPassword,
} from './auth.js';
import type { AuthStore } from './auth.js';

export interface AppOptions {
  readonly logger?: boolean;
  readonly authStore?: AuthStore;
  readonly authSecret?: string;
  readonly publicAppUrl?: string;
  readonly secureCookies?: boolean;
}

export function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger:
      options.logger === false
        ? false
        : {
            redact: {
              paths: [
                'req.headers.authorization',
                'req.headers.cookie',
                'res.headers.set-cookie',
                '*.token',
                '*.cookie',
                '*.ciphertext',
                '*.privateKey',
              ],
              censor: '[REDACTED]',
            },
          },
    requestIdHeader: 'x-request-id',
    trustProxy: '127.0.0.1',
    bodyLimit: 1_048_576,
  }).withTypeProvider<TypeBoxTypeProvider>();

  void app.register(cookie);
  void app.register(rateLimit, { global: false });

  app.addHook('onSend', (_request, reply, _payload, done) => {
    void reply.headers({
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'x-frame-options': 'DENY',
      'referrer-policy': 'no-referrer',
    });
    done();
  });

  app.get('/health', { schema: { response: { 200: HealthResponseSchema } } }, () => ({
    status: 'ok' as const,
    service: 'pinjamakun-api' as const,
    timestamp: new Date().toISOString(),
  }));

  const { authStore, authSecret, publicAppUrl } = options;
  if (authStore && authSecret && publicAppUrl) {
    const cookieOptions = {
      path: '/',
      httpOnly: true,
      secure: options.secureCookies ?? false,
      sameSite: 'strict' as const,
      maxAge: sessionLifetimeSeconds,
    };
    const assertTrustedOrigin = (origin: string | undefined): boolean => origin === publicAppUrl;
    const issueSession = async (userId: string, reply: FastifyReply) => {
      const token = createSessionToken();
      await authStore.createSession(
        userId,
        digestSessionToken(token, authSecret),
        new Date(Date.now() + sessionLifetimeSeconds * 1000),
      );
      reply.setCookie(sessionCookieName, token, cookieOptions);
    };

    app.post(
      '/auth/register',
      {
        config: { rateLimit: { max: 5, timeWindow: '15 minutes' } },
        schema: {
          body: AuthCredentialsSchema,
          response: { 201: AuthResponseSchema, 400: AuthErrorSchema, 409: AuthErrorSchema },
        },
      },
      async (request, reply) => {
        if (!assertTrustedOrigin(request.headers.origin)) {
          return reply.code(400).send({ error: 'Permintaan tidak valid.' });
        }
        const email = normalizeEmail(request.body.email);
        const user = await authStore.createUser(email, await hashPassword(request.body.password));
        if (!user) return reply.code(409).send({ error: 'Email sudah terdaftar.' });
        await issueSession(user.id, reply);
        return reply.code(201).send({ user });
      },
    );

    app.post(
      '/auth/login',
      {
        config: { rateLimit: { max: 10, timeWindow: '15 minutes' } },
        schema: {
          body: AuthCredentialsSchema,
          response: { 200: AuthResponseSchema, 400: AuthErrorSchema, 401: AuthErrorSchema },
        },
      },
      async (request, reply) => {
        if (!assertTrustedOrigin(request.headers.origin)) {
          return reply.code(400).send({ error: 'Permintaan tidak valid.' });
        }
        const user = await authStore.findUserByEmail(normalizeEmail(request.body.email));
        if (!user || !(await verifyPassword(user.passwordHash, request.body.password))) {
          return reply.code(401).send({ error: 'Email atau password salah.' });
        }
        await issueSession(user.id, reply);
        return { user: { id: user.id, email: user.email } };
      },
    );

    app.get(
      '/auth/me',
      { schema: { response: { 200: AuthResponseSchema, 401: AuthErrorSchema } } },
      async (request, reply) => {
        const token = request.cookies[sessionCookieName];
        if (!token) return reply.code(401).send({ error: 'Belum masuk.' });
        const user = await authStore.findUserBySession(
          digestSessionToken(token, authSecret),
          new Date(),
        );
        if (!user) return reply.code(401).send({ error: 'Sesi tidak valid.' });
        return { user };
      },
    );

    app.post('/auth/logout', async (request, reply) => {
      if (!assertTrustedOrigin(request.headers.origin)) {
        return reply.code(400).send({ error: 'Permintaan tidak valid.' });
      }
      const token = request.cookies[sessionCookieName];
      if (token) await authStore.deleteSession(digestSessionToken(token, authSecret));
      reply.clearCookie(sessionCookieName, { path: '/' });
      return reply.code(204).send();
    });

    app.addHook('onClose', async () => authStore.close());
  }

  return app;
}
