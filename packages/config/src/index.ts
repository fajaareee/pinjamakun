export function requireEnvironment(
  environment: Readonly<Record<string, string | undefined>>,
  name: string,
): string {
  const value = environment[name];
  if (value === undefined || value.trim() === '') throw new Error(`Missing environment: ${name}`);
  return value;
}
