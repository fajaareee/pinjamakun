export function requireEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name];
  if (value === undefined || value.trim() === '') throw new Error(`Missing environment: ${name}`);
  return value;
}

export type NodeEnvironment = 'development' | 'production' | 'test';

export interface ApiEnvironment {
  readonly nodeEnvironment: NodeEnvironment;
  readonly host: string;
  readonly port: number;
}

const nodeEnvironments = new Set<NodeEnvironment>(['development', 'production', 'test']);

function readPort(value: string | undefined): number {
  const port = Number(value ?? '3000');
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('API_PORT must be an integer between 1 and 65535');
  }
  return port;
}

export function readApiEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
): ApiEnvironment {
  const nodeEnvironment = environment.NODE_ENV ?? 'development';
  if (!nodeEnvironments.has(nodeEnvironment as NodeEnvironment)) {
    throw new Error('NODE_ENV must be development, production, or test');
  }

  const host = environment.API_HOST?.trim() || '127.0.0.1';
  if (nodeEnvironment === 'production' && host !== '127.0.0.1' && host !== '::1') {
    throw new Error('API_HOST must bind to loopback in production');
  }

  return {
    nodeEnvironment: nodeEnvironment as NodeEnvironment,
    host,
    port: readPort(environment.API_PORT),
  };
}
