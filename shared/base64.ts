/**
 * A dependency-free `Uint8Array` <-> base64 codec.
 *
 * Card-number encryption (`server/_core/card-cipher.ts`) needs to run
 * identically on the server (Node) and on-device (Hermes, via
 * `crypto.native.ts`), and neither `Buffer` (a Node global RN does not
 * polyfill) nor `btoa`/`atob` (not guaranteed present in Hermes) can be
 * assumed available on both. This is the same base64 alphabet and padding
 * rules either would use — just implemented directly against bytes so it
 * has no environment dependency at all.
 */

const ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  let i = 0;
  for (; i + 3 <= bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out +=
      ALPHABET[(chunk >> 18) & 0x3f] +
      ALPHABET[(chunk >> 12) & 0x3f] +
      ALPHABET[(chunk >> 6) & 0x3f] +
      ALPHABET[chunk & 0x3f];
  }

  const remaining = bytes.length - i;
  if (remaining === 1) {
    const chunk = bytes[i] << 16;
    out +=
      ALPHABET[(chunk >> 18) & 0x3f] + ALPHABET[(chunk >> 12) & 0x3f] + "==";
  } else if (remaining === 2) {
    const chunk = (bytes[i] << 16) | (bytes[i + 1] << 8);
    out +=
      ALPHABET[(chunk >> 18) & 0x3f] +
      ALPHABET[(chunk >> 12) & 0x3f] +
      ALPHABET[(chunk >> 6) & 0x3f] +
      "=";
  }

  return out;
}

const DECODE_TABLE: Record<string, number> = {};
for (let i = 0; i < ALPHABET.length; i++) {
  DECODE_TABLE[ALPHABET[i]] = i;
}

/**
 * Parses an even-length hex string into bytes. Used alongside the base64
 * codec above by `server/_core/card-cipher.ts`'s key parsing, which accepts
 * `CARD_ENCRYPTION_KEY` in either encoding — kept here rather than a
 * separate module since both are small, dependency-free byte codecs with
 * the same reason to exist (no `Buffer` assumed available).
 */
export function hexToBytes(hex: string): Uint8Array {
  if (hex.length % 2 !== 0) {
    throw new Error("hexToBytes: hex string must have an even length");
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    const byte = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
    if (Number.isNaN(byte)) {
      throw new Error(`hexToBytes: invalid hex byte "${hex.slice(i * 2, i * 2 + 2)}"`);
    }
    bytes[i] = byte;
  }
  return bytes;
}

export function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/=+$/, "");
  const byteLength = Math.floor((clean.length * 6) / 8);
  const bytes = new Uint8Array(byteLength);

  let bitBuffer = 0;
  let bitCount = 0;
  let outIndex = 0;

  for (const char of clean) {
    const value = DECODE_TABLE[char];
    if (value === undefined) {
      throw new Error(`base64ToBytes: invalid character "${char}"`);
    }
    bitBuffer = (bitBuffer << 6) | value;
    bitCount += 6;
    if (bitCount >= 8) {
      bitCount -= 8;
      bytes[outIndex++] = (bitBuffer >> bitCount) & 0xff;
    }
  }

  return bytes;
}
