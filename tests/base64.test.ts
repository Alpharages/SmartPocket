import { describe, expect, it } from "vitest";
import { base64ToBytes, bytesToBase64, hexToBytes } from "@shared/base64";

function utf8(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

describe("bytesToBase64 / base64ToBytes", () => {
  it.each([
    ["", ""],
    ["f", "Zg=="],
    ["fo", "Zm8="],
    ["foo", "Zm9v"],
    ["foob", "Zm9vYg=="],
    ["fooba", "Zm9vYmE="],
    ["foobar", "Zm9vYmFy"],
  ])("encodes %j to %j (RFC 4648 test vectors)", (input, expected) => {
    expect(bytesToBase64(utf8(input))).toBe(expected);
  });

  it("round-trips arbitrary binary data, including every byte value", () => {
    const bytes = new Uint8Array(256);
    for (let i = 0; i < 256; i++) bytes[i] = i;

    const encoded = bytesToBase64(bytes);
    const decoded = base64ToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(bytes));
  });

  it("round-trips at every remainder length (0, 1, 2 bytes over a multiple of 3)", () => {
    for (const len of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const bytes = new Uint8Array(len).map((_, i) => (i * 7) % 256);
      expect(Array.from(base64ToBytes(bytesToBase64(bytes)))).toEqual(
        Array.from(bytes),
      );
    }
  });

  it("rejects an invalid character", () => {
    expect(() => base64ToBytes("not valid!")).toThrow(/invalid character/);
  });
});

describe("hexToBytes", () => {
  it("decodes a hex string to the matching bytes", () => {
    expect(Array.from(hexToBytes("00ff10"))).toEqual([0x00, 0xff, 0x10]);
  });

  it("round-trips a 32-byte key", () => {
    const hex =
      "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    expect(hexToBytes(hex)).toHaveLength(32);
  });

  it("rejects an odd-length string", () => {
    expect(() => hexToBytes("abc")).toThrow(/even length/);
  });

  it("rejects a non-hex byte", () => {
    expect(() => hexToBytes("zz")).toThrow(/invalid hex byte/);
  });
});
