/**
 * Vitest setup for React Native component tests.
 *
 * We render components with `react-test-renderer` (see the note in
 * `tests/components/Button.test.tsx` for why RNTL isn't viable in this node
 * vitest setup). Two bits of housekeeping:
 *
 *  1. Opt into React's `act()` environment so state updates flush correctly and
 *     React doesn't warn "not configured to support act(...)".
 *  2. Suppress *only* react-test-renderer's own deprecation banner — a known,
 *     deliberate trade-off here — while letting every other console.error
 *     (including real React warnings) through untouched.
 */
(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

// Fixed 32-byte test key for server crypto unit/integration tests.
process.env.CARD_ENCRYPTION_KEY ??=
  "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

const originalError = console.error.bind(console);
console.error = (...args: unknown[]) => {
  if (
    typeof args[0] === "string" &&
    args[0].includes("react-test-renderer is deprecated")
  ) {
    return;
  }
  originalError(...args);
};
