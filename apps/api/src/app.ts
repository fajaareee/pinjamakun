import Fastify from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { HealthResponseSchema } from '@pinjamakun/contracts';

export interface AppOptions {
  readonly logger?: boolean;
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

  return app;
}
