import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * Regression guard for a real bug caught only by actually running the web
 * build (unit tests mock every server import, so they never notice this):
 * components/sync-settings.tsx unconditionally imported lib/sync/sync-worker.ts,
 * which pulls in server/_core/sync-engine.ts and server/_core/local-context.ts,
 * which import server/db.ts -> server/_core/db-query.ts -> `mysql2` — a
 * Node-only package that crashes at runtime in a browser (no `process.env`
 * Node polyfill). Metro resolves `./_core/db-query` to db-query.native.ts on
 * native (SQLite, no mysql2), but there is no db-query.web.ts, so web got the
 * plain MySQL-backed default and the whole app failed to load.
 *
 * This is a lightweight static walk of the import graph, not a real bundler —
 * it resolves relative/@//@shared imports the way Metro's platform-extension
 * resolution does for **web** (prefer `.web.ts(x)`, then bare `.ts(x)`, never
 * `.native.ts(x)`), and just checks which external packages the closure pulls
 * in. That's enough to catch this exact class of regression cheaply, without
 * needing to actually run Metro.
 */
const ROOT = path.resolve(__dirname, "..");

// Packages that must never end up in web's client bundle at all — each is
// Node/server-only and known to crash (or would clearly break) in a browser.
const FORBIDDEN_PACKAGES = ["mysql2", "mysql2/promise", "node:sqlite"];

/**
 * `import type { X } from "..."` (and `export type ... from "..."`) is
 * erased entirely at compile time — it produces no runtime `require()`, so
 * a real bundler never follows it. `lib/trpc.ts`'s `import type { AppRouter }
 * from "@/server/routers"` is exactly this: syntactically "importing" the
 * whole router (and therefore, naively, everything it imports), but actually
 * inert at runtime. Only whole-statement `import type`/`export type` is
 * excluded here — `import { foo, type Bar } from "..."` still causes a real
 * import (of `foo`) and is deliberately still followed.
 */
function extractImportSpecifiers(
  filePath: string,
): Array<{ spec: string; typeOnly: boolean }> {
  const src = fs.readFileSync(filePath, "utf8");
  const specs: Array<{ spec: string; typeOnly: boolean }> = [];
  const importRe =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^'";]*?from\s+)?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = importRe.exec(src))) {
    specs.push({ spec: match[2], typeOnly: Boolean(match[1]) });
  }
  return specs;
}

function resolveLocalImport(fromFile: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@shared/")) {
    base = path.join(ROOT, "shared", spec.slice("@shared/".length));
  } else if (spec.startsWith("@/")) {
    base = path.join(ROOT, spec.slice(2));
  } else if (spec.startsWith(".")) {
    base = path.join(path.dirname(fromFile), spec);
  } else {
    return null; // external package — not resolvable on disk
  }

  // A source literally written as "../shared/const.js" still resolves to the
  // .ts file on disk — strip a trailing JS extension before re-adding one.
  base = base.replace(/\.(m|c)?jsx?$/, "");

  const candidates = [
    `${base}.web.ts`,
    `${base}.web.tsx`,
    `${base}.ts`,
    `${base}.tsx`,
    path.join(base, "index.ts"),
    path.join(base, "index.tsx"),
  ];
  return candidates.find((c) => fs.existsSync(c)) ?? null;
}

function walkImportGraph(entryFile: string): {
  visitedFiles: Set<string>;
  externalPackages: Set<string>;
} {
  const visitedFiles = new Set<string>();
  const externalPackages = new Set<string>();
  const stack = [entryFile];

  while (stack.length > 0) {
    const file = stack.pop()!;
    if (visitedFiles.has(file)) continue;
    visitedFiles.add(file);

    for (const { spec, typeOnly } of extractImportSpecifiers(file)) {
      if (typeOnly) continue; // erased before a real bundler ever sees it

      const resolved = resolveLocalImport(file, spec);
      if (resolved) {
        if (!visitedFiles.has(resolved)) stack.push(resolved);
      } else if (
        spec.startsWith(".") ||
        spec.startsWith("@/") ||
        spec.startsWith("@shared/")
      ) {
        // A local spec that didn't resolve to a file — not a package, just
        // an unresolved path; nothing to flag.
      } else {
        externalPackages.add(spec);
      }
    }
  }

  return { visitedFiles, externalPackages };
}

describe("web bundle import graph", () => {
  it("app/settings.tsx's web-resolved closure never pulls in a server-only DB driver", () => {
    const { externalPackages } = walkImportGraph(
      path.join(ROOT, "app/settings.tsx"),
    );

    for (const forbidden of FORBIDDEN_PACKAGES) {
      expect(externalPackages).not.toContain(forbidden);
    }
  });

  it("app/_layout.tsx's web-resolved closure never pulls in a server-only DB driver", () => {
    const { externalPackages } = walkImportGraph(
      path.join(ROOT, "app/_layout.tsx"),
    );

    for (const forbidden of FORBIDDEN_PACKAGES) {
      expect(externalPackages).not.toContain(forbidden);
    }
  });

  // Both stubs, not just the Settings one: sync-gate.tsx is mounted from
  // app/_layout.tsx, so a value import leaking out of it would pull the DB
  // driver into every web page rather than just the Settings route.
  it.each(["components/sync-settings.web.tsx", "components/sync-gate.web.tsx"])(
    "%s (the actual web-resolved file) has no value imports at all",
    (stub) => {
      const webStub = path.join(ROOT, stub);
      expect(fs.existsSync(webStub)).toBe(true);
      expect(
        extractImportSpecifiers(webStub).filter((i) => !i.typeOnly),
      ).toEqual([]);
    },
  );
});
