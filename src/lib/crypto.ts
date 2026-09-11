import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Envelope encryption for host Moove API keys at rest.
 *
 * AES-256-GCM for confidentiality (key material never sits in plaintext), plus
 * an HMAC-SHA256 authentication tag over the ciphertext so tampering with the
 * stored value is detected at decrypt time.
 *
 * The master key is HOST_KEY_SECRET. It is never logged or committed.
 */

const ALGO = "aes-256-gcm";
const HMAC_ALGO = "sha256";

function masterKeyBytes(secret: string): Buffer {
  // Derive a stable 32-byte key from the secret (any length) via HMAC.
  return createHmac(HMAC_ALGO, "splitpot-key-derivation").update(secret).digest();
}

/** Encrypt a secret string into a storable envelope string. */
export function encryptSecret(plaintext: string, secret: string): string {
  const key = masterKeyBytes(secret);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const hmac = createHmac(HMAC_ALGO, key).update(iv).update(ciphertext).update(authTag).digest();
  return [
    "v1",
    iv.toString("base64"),
    ciphertext.toString("base64"),
    authTag.toString("base64"),
    hmac.toString("base64"),
  ].join(".");
}

/** Decrypt an envelope produced by encryptSecret. Throws if tampered or wrong secret. */
export function decryptSecret(envelope: string, secret: string): string {
  const parts = envelope.split(".");
  if (parts.length !== 5 || parts[0] !== "v1") {
    throw new Error("Malformed encrypted secret");
  }
  const [, ivB64, ctB64, tagB64, hmacB64] = parts;
  const key = masterKeyBytes(secret);
  const iv = Buffer.from(ivB64, "base64");
  const ciphertext = Buffer.from(ctB64, "base64");
  const authTag = Buffer.from(tagB64, "base64");
  const expected = createHmac(HMAC_ALGO, key).update(iv).update(ciphertext).update(authTag).digest();
  const actual = Buffer.from(hmacB64, "base64");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Encrypted secret failed integrity check");
  }
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Constant-time string compare for session/auth checks. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
