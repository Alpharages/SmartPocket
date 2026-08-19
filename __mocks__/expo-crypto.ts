/**
 * `expo-crypto` is a native module; under vitest the real one pulls in
 * expo-modules-core and throws. The polyfill it backs
 * (lib/_core/crypto-polyfill.ts) only installs itself when the runtime has no
 * `crypto.getRandomValues` — Node has one, so in tests this is never called.
 */
export function getRandomValues<T extends ArrayBufferView | null>(array: T): T {
  if (array) globalThis.crypto.getRandomValues(array as never);
  return array;
}
