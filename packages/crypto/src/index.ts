export const CRYPTO_PROTOCOL_VERSION = 1 as const;

export type DeviceKeyPair = Readonly<{
  publicKey: CryptoKey;
  privateKey: CryptoKey;
}>;

export async function createDeviceKeyPair(): Promise<DeviceKeyPair> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, false, [
    'deriveKey',
    'deriveBits',
  ]);
  return { publicKey: pair.publicKey, privateKey: pair.privateKey };
}

export async function exportPublicKey(publicKey: CryptoKey): Promise<JsonWebKey> {
  return crypto.subtle.exportKey('jwk', publicKey);
}

export async function createSnapshotKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptSnapshot(
  plaintext: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  associatedData: Uint8Array<ArrayBuffer>,
): Promise<Readonly<{ nonce: Uint8Array<ArrayBuffer>; ciphertext: ArrayBuffer }>> {
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: associatedData },
    key,
    plaintext,
  );
  return { nonce, ciphertext };
}

export async function decryptSnapshot(
  ciphertext: ArrayBuffer,
  nonce: Uint8Array<ArrayBuffer>,
  key: CryptoKey,
  associatedData: Uint8Array<ArrayBuffer>,
): Promise<ArrayBuffer> {
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: nonce, additionalData: associatedData },
    key,
    ciphertext,
  );
}
