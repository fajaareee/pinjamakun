import { readApiEnvironment } from '@pinjamakun/config';
import { buildApp } from './app.js';
import { createPostgresAuthStore } from './auth.js';

const environment = readApiEnvironment(process.env);
const app = buildApp({
  authStore: createPostgresAuthStore(environment.databaseUrl),
  authSecret: environment.authSecret,
  publicAppUrl: environment.publicAppUrl,
  secureCookies: environment.nodeEnvironment === 'production',
});

function stop(signal: NodeJS.Signals) {
  app.log.info({ signal }, 'API shutting down');
  void app.close().catch((error: unknown) => {
    app.log.error({ err: error }, 'API failed to shut down cleanly');
    process.exitCode = 1;
  });
}

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await app.listen({ host: environment.host, port: environment.port });
} catch (error) {
  app.log.error({ err: error }, 'API failed to start');
  process.exitCode = 1;
}
