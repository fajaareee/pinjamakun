import { describe, expect, it } from 'vitest';
import { createSnapshotKey, decryptSnapshot, encryptSnapshot } from './index.js';

describe('snapshot encryption', () => {
  it('round trips authenticated content', async () => {
    const key = await createSnapshotKey();
    const message = new TextEncoder().encode('sensitive-cookie-snapshot');
    const aad = new TextEncoder().encode('snapshot-id:version-1');
    const encrypted = await encryptSnapshot(message, key, aad);
    const plaintext = await decryptSnapshot(encrypted.ciphertext, encrypted.nonce, key, aad);
    expect(new TextDecoder().decode(plaintext)).toBe('sensitive-cookie-snapshot');
  });

  it('rejects incorrect associated data', async () => {
    const key = await createSnapshotKey();
    const encrypted = await encryptSnapshot(
      new TextEncoder().encode('secret'),
      key,
      new TextEncoder().encode('correct'),
    );
    await expect(
      decryptSnapshot(
        encrypted.ciphertext,
        encrypted.nonce,
        key,
        new TextEncoder().encode('wrong'),
      ),
    ).rejects.toThrow();
  });
});
