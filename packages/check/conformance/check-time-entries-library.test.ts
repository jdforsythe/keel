// Spec: k.themes, clause "In a project with a `node` module `a`, `import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`, and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`; there is none for those imports in `tokens.ts`, in `tokens.design.ts` that only `tokens.ts` imports, in `modules/a/A.test.tsx`, in `vite.config.ts` or in `modules/a/a.server.ts`, nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`; when `A.tsx` also imports `tokens.ts`, `tokens.ts`'s import is one E1818; `keel build` with any E1818 exits 1 and writes no `dist/`."
// Paragraph k.themes Check-time entries (no Conformance sentence of its own): "A value import of either (`import`, `export ... from` or `import()`; `import type` is free) is E1818 at its specifier in each code file (k.check Trailer) of an app or library, but in a server-only file (k.boundary), a test file (`*.test.*`, `*.spec.*`) and a tool config (`*.config.*`), and in `tokens.ts` at a project root, each file it imports and a library's `src/<id>Tokens.ts` (k.looks) while no client entry reaches them: no route `component` and no file of a `client` module, by value imports, re-exports and `import()` (k.boundary Following). Message: `<entry> is check and build time only; use token names or @keel/ui/brand`, `<entry>` `@keel/ui/tokens` or `@keel/ui/css`; fix: none."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The library half of E1818, through `check()` over the k.looks fixture (library-looks-support.ts): a library's code file and its `src/<id>Tokens.ts`. The app half, over the binary, is packages/cli/conformance/check-time-entries-e1818.test.ts; `keel build`'s: check-time-entries-build.test.ts.
// ASSUMPTIONS: the fixture's `src/Badge.tsx` is reached from the app's route component `modules/shop/Page.tsx` through `@acme/ui` (k.boundary Following: a listed library's `exports` entry is followed to the file it gives). A diagnostic's position is the opening quote of the specifier, as E1013's.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { BRAND_ONLY, ROOT, SEED, SHIPPED, app, atText, badgeSource, sourceOf } from "./library-looks-support.ts";
import { brandTokens } from "@keel/ui/brand";

const e1818 = (files: ReturnType<typeof app>) =>
  check(files, { types: false, artifacts: { tokens: brandTokens } }).diagnostics.filter((d) => d.code === "E1818");
const MSG = (entry: string): string => `${entry} is check and build time only; use token names or @keel/ui/brand`;
const BADGE = `${ROOT}/src/Badge.tsx`;

describe("k.themes: E1818 in a library", () => {
  test(
    "a library's `src/<id>Tokens.ts` that imports `@keel/ui/tokens` and that no client entry reaches is no E1818",
    () => {
      expect(e1818(app(BRAND_ONLY))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`import { contrast } from '@keel/ui/css'` in a library component the app's route component reaches is one E1818 at the specifier, with message `@keel/ui/css is check and build time only; use token names or @keel/ui/brand`",
    () => {
      const badge = `import { contrast } from '@keel/ui/css'\n${badgeSource()}`;
      const d = e1818(app(BRAND_ONLY, [{ path: BADGE, source: badge }]));
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(MSG("@keel/ui/css"));
      expect(d[0]?.path).toBe(BADGE);
      expect(d[0]?.fix).toBeUndefined();
      expect(atText(badge, "'@keel/ui/css'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(true);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`src/<id>Tokens.ts` imported by a component a client entry reaches is one E1818 for its `@keel/ui/tokens` import, at the specifier",
    () => {
      const badge = `import { acmeTokens } from './acmeTokens.ts'\n${badgeSource()}`;
      const d = e1818(app(BRAND_ONLY, [{ path: BADGE, source: badge }]));
      expect(d).toHaveLength(1);
      expect(d[0]?.message).toBe(MSG("@keel/ui/tokens"));
      expect(d[0]?.path).toBe(SHIPPED);
      expect(atText(sourceOf(app(BRAND_ONLY), SHIPPED), "'@keel/ui/tokens'", d[0]?.line ?? 0, d[0]?.col ?? 0)).toBe(
        true,
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a type-only import of either entry in a library component is free, whatever the entry",
    () => {
      fc.assert(
        fc.property(fc.constantFrom("@keel/ui/tokens", "@keel/ui/css"), (entry) => {
          const badge = `import type { Anything } from '${entry}'\n${badgeSource()}`;
          expect(e1818(app(BRAND_ONLY, [{ path: BADGE, source: badge }]))).toEqual([]);
        }),
        { seed: SEED, numRuns: 2 },
      );
    },
    CHECK_CASE_BOUND,
  );

  test(
    "`export ... from` and `import()` of either entry in a library component a client entry reaches are each one E1818",
    () => {
      for (const [src, entry] of [
        ["export { defineTokens } from '@keel/ui/tokens'\n", "@keel/ui/tokens"],
        ["export * from '@keel/ui/css'\n", "@keel/ui/css"],
        ["export const load = () => import('@keel/ui/css')\n", "@keel/ui/css"],
      ] as const) {
        const d = e1818(app(BRAND_ONLY, [{ path: BADGE, source: `${src}${badgeSource()}` }]));
        expect(d, src).toHaveLength(1);
        expect(d[0]?.message, src).toBe(MSG(entry));
      }
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a library's test file and tool config importing either entry are no E1818",
    () => {
      const files = app(BRAND_ONLY, [
        { path: `${ROOT}/src/Badge.test.tsx`, source: "import { contrast } from '@keel/ui/css'\nexport {}\n" },
        { path: `${ROOT}/src/Badge.spec.ts`, source: "import { defineTokens } from '@keel/ui/tokens'\nexport {}\n" },
        { path: `${ROOT}/tsup.config.ts`, source: "import { contrast } from '@keel/ui/css'\nexport default {}\n" },
      ]);
      expect(e1818(files)).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );
});
