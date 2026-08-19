import * as ExpoCrypto from "expo-crypto";

/**
 * Gives the app a `crypto.getRandomValues`.
 *
 * Hermes ships no Web Crypto, and `@noble/ciphers` / `@noble/hashes` call
 * `crypto.getRandomValues` for every piece of randomness they need — so
 * without this, on a real device:
 *
 *   - encrypting a card number throws (`card-cipher.ts` draws a fresh IV per
 *     encryption),
 *   - the device's card key cannot be minted (`crypto.native.ts`),
 *   - an App Lock PIN cannot be salted (`pin-crypto.ts`).
 *
 * All three failed silently in the ways failures like this always do: the
 * Cards screen rendered a card with no last four, and the whole list vanished
 * before `toSafeCreditCard` learned to degrade one row at a time. Node and
 * jsdom both provide Web Crypto, so every test passed throughout.
 *
 * Imported for its side effect from `app/_layout.tsx`, ahead of anything that
 * could reach for randomness. `expo-crypto`'s `getRandomValues` is backed by
 * the platform CSPRNG (`SecRandomCopyBytes` / `SecureRandom`), which is the
 * only acceptable source here — a `Math.random()` shim would silently reduce
 * every key and IV in the app to guessable noise.
 */
const globalWithCrypto = globalThis as typeof globalThis & {
  crypto?: Partial<Crypto>;
};

if (typeof globalWithCrypto.crypto?.getRandomValues !== "function") {
  const existing = globalWithCrypto.crypto ?? {};
  // Assigned onto whatever `crypto` object already exists rather than
  // replacing it — Hermes defines a partial one, and clobbering it would drop
  // anything else the runtime put there.
  Object.defineProperty(globalWithCrypto, "crypto", {
    configurable: true,
    enumerable: false,
    writable: true,
    value: Object.assign(existing, {
      getRandomValues: ExpoCrypto.getRandomValues,
    }),
  });
}
