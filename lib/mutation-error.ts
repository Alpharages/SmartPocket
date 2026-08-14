/**
 * Turns a rejected mutation into the message the user should see.
 *
 * SP-083: every handler in `expense-context` caught with a bare `catch {}` and
 * showed a hardcoded string, so the server's actual explanation — "An expense
 * category named "Groceries" already exists." — was replaced by the useless
 * "Failed to add category". Prefer the real message; fall back only when there
 * genuinely isn't one.
 */
export function getMutationErrorMessage(
  err: unknown,
  fallback: string,
): string {
  if (
    err &&
    typeof err === "object" &&
    "message" in err &&
    typeof (err as { message: unknown }).message === "string" &&
    (err as { message: string }).message.trim().length > 0
  ) {
    return (err as { message: string }).message;
  }
  return fallback;
}
