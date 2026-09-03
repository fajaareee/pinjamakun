import { readApiEnvironment } from '@pinjamakun/config';
import { buildApp } from './app.js';

const app = buildApp();

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
  const environment = readApiEnvironment(process.env);
  await app.listen({ host: environment.host, port: environment.port });
} catch (error) {
  app.log.error({ err: error }, 'API failed to start');
  process.exitCode = 1;
}
