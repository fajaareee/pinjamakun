export function normalizeWebOrigin(rawUrl: string): string {
  const url = new URL(rawUrl);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS pages are supported.');
  }
  return `${url.protocol}//${url.hostname}/*`;
}

export async function requestCurrentSitePermission(rawUrl: string): Promise<boolean> {
  const { default: browser } = await import('webextension-polyfill');
  const origin = normalizeWebOrigin(rawUrl);
  return browser.permissions.request({ origins: [origin] });
}
