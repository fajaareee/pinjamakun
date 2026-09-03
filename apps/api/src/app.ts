import Fastify from 'fastify';
import type { TypeBoxTypeProvider } from '@fastify/type-provider-typebox';
import { HealthResponseSchema } from '@pinjamakun/contracts';

export function buildApp() {
  const app = Fastify({
    logger: {
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
  }).withTypeProvider<TypeBoxTypeProvider>();

  app.get('/health', { schema: { response: { 200: HealthResponseSchema } } }, () => ({
    status: 'ok' as const,
    service: 'pinjamakun-api' as const,
    timestamp: new Date().toISOString(),
  }));

  return app;
}
