import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

/**
 * Guards the fix for the web "invisible screen" blocker.
 *
 * Reanimated's web build mounts an element carrying an `entering` animation
 * with `visibility: hidden` and only restores it from `onanimationstart`. When
 * the animation never starts — a screen mounted during a full page load — the
 * content stays laid out and permanently invisible, and the built-in builders
 * skip the timeout fallback. `lib/motion.web.tsx` strips `entering`/`exiting`
 * on web; that only works if screens import `Animated` from `@/lib/motion`
 * rather than reaching for `react-native-reanimated` directly.
 *
 * This is a source-level check on purpose: the vitest config aliases
 * `react-native-reanimated` to a mock, so a render test here would assert
 * against the mock's behaviour, not Reanimated's.
 */

const ROOT = path.resolve(__dirname, "..");
const SEARCH_DIRS = ["app", "components"];

function collectSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules") continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...collectSourceFiles(full));
    } else if (/\.(tsx|ts)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

const files = SEARCH_DIRS.flatMap((dir) =>
  collectSourceFiles(path.join(ROOT, dir)),
);

describe("layout-entering animations go through @/lib/motion", () => {
  it("finds the screens that use entering animations", () => {
    const users = files.filter((f) =>
      readFileSync(f, "utf8").includes("entering={"),
    );
    // Sanity: if this ever hits zero the assertion below passes vacuously.
    expect(users.length).toBeGreaterThan(0);
  });

  it("never imports Animated straight from react-native-reanimated alongside entering=", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, "utf8");
      if (!source.includes("entering={")) continue;

      // `import Animated, { FadeInUp } from "react-native-reanimated"` — the
      // default import is the one that yields the un-stripped Animated.View.
      if (
        /import\s+Animated\s*(,|from)[^\n]*"react-native-reanimated"/.test(
          source,
        )
      ) {
        offenders.push(path.relative(ROOT, file));
      }
    }

    expect(offenders).toEqual([]);
  });
});
