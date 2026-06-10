import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

import { ENV } from "./env";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const VERSION_PREFIX = "v1:";

function parseEncryptionKey(raw: string): Buffer {
  if (!raw) {
    throw new Error(
      "CARD_ENCRYPTION_KEY is not set — card numbers cannot be encrypted at rest",
    );
  }

  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }

  const decoded = Buffer.from(raw, "base64");
  if (decoded.length === 32) {
    return decoded;
  }

  throw new Error(
    "CARD_ENCRYPTION_KEY must be 32 bytes (64-char hex or base64 encoding 32 bytes)",
  );
}

function getEncryptionKey(): Buffer {
  return parseEncryptionKey(ENV.cardEncryptionKey);
}

export function isEncryptedCardNumber(stored: string): boolean {
  return stored.startsWith(VERSION_PREFIX);
}

/** Encrypt a plaintext PAN for storage. Idempotent when already encrypted. */
export function encryptCardNumber(plain: string): string {
  if (isEncryptedCardNumber(plain)) {
    return plain;
  }

  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plain, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${VERSION_PREFIX}${iv.toString("base64")}:${authTag.toString("base64")}:${ciphertext.toString("base64")}`;
}

/**
 * Decrypt a stored card number. Legacy plaintext rows (pre-migration) pass through.
 */
export function decryptCardNumber(stored: string): string {
  if (!isEncryptedCardNumber(stored)) {
    return stored;
  }

  const payload = stored.slice(VERSION_PREFIX.length);
  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("Invalid encrypted card number format");
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = getEncryptionKey();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
}
