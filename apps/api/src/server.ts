import { buildApp } from './app.js';

const port = Number.parseInt(process.env.API_PORT ?? '3000', 10);
const host = process.env.API_HOST ?? '127.0.0.1';
const app = buildApp();

try {
  await app.listen({ host, port });
} catch (error) {
  app.log.error({ err: error }, 'API failed to start');
  process.exitCode = 1;
}
