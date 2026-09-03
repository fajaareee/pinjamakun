import { describe, expect, it } from 'vitest';
import { normalizeWebOrigin } from './permissions.js';

describe('normalizeWebOrigin', () => {
  it('limits permission to the current HTTPS host', () => {
    expect(normalizeWebOrigin('https://accounts.example.com/path?q=1')).toBe(
      'https://accounts.example.com/*',
    );
  });

  it('rejects browser internal pages', () => {
    expect(() => normalizeWebOrigin('chrome://extensions')).toThrow();
  });
});
