import { randomBytes, createCipheriv, createDecipheriv } from "node:crypto";

/**
 * Envelope encryption for secrets at rest (Plaid access tokens).
 * AES-256-GCM: MASTER_KEY is a 32-byte key, base64-encoded in env
 * (`openssl rand -base64 32`). Never logged, never returned by any API.
 */

function decodeMasterKey(base64Key: string): Buffer {
  const buf = Buffer.from(base64Key, "base64");
  if (buf.length !== 32) {
    throw new Error("MASTER_KEY must decode to exactly 32 bytes");
  }
  return buf;
}

function getMasterKey(): Buffer {
  const key = process.env.MASTER_KEY;
  if (!key) throw new Error("MASTER_KEY is not set");
  return decodeMasterKey(key);
}

export interface EncryptedPayload {
  ciphertext: string; // base64
  iv: string; // base64
  tag: string; // base64
}

/**
 * `keyOverride` (base64, 32 bytes) exists only for scripts/rotate-master-key.ts,
 * which re-encrypts every stored token under a new key and needs to address
 * the old and new keys explicitly rather than through `process.env.MASTER_KEY`.
 * Every other call site omits it and uses the live env key.
 */
export function encryptSecret(plaintext: string, keyOverride?: string): EncryptedPayload {
  const key = keyOverride ? decodeMasterKey(keyOverride) : getMasterKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString("base64"),
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptSecret(payload: EncryptedPayload, keyOverride?: string): string {
  const key = keyOverride ? decodeMasterKey(keyOverride) : getMasterKey();
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(payload.iv, "base64"));
  decipher.setAuthTag(Buffer.from(payload.tag, "base64"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, "base64")),
    decipher.final(),
  ]);
  return plaintext.toString("utf8");
}
