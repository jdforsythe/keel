// Spec: k.check-time, clause "In a project with a `node` module `a`, `import { defineTokens } from '@keel/ui/tokens'` in route component `modules/a/A.tsx` is one E1818 at the specifier with message `@keel/ui/tokens is check and build time only; use token names or @keel/ui/brand`, and `import { contrast } from '@keel/ui/css'` in `lib/tone.ts`, which `A.tsx` imports, one with `@keel/ui/css`; there is none for those imports in `tokens.ts`, in `tokens.design.ts` that only `tokens.ts` imports, in `modules/a/A.test.tsx`, in `vite.config.ts` or in `modules/a/a.server.ts`, nor for `import type { Tokens } from '@keel/ui/tokens'` in `A.tsx`; when `A.tsx` also imports `tokens.ts`, there are two E1818, both at `A.tsx`'s specifier `'../../tokens.ts'`, with messages `tokens.ts imports @keel/ui/tokens, check and build time only` and `tokens.design.ts imports @keel/ui/tokens, check and build time only`, and none in either file; `keel build` with any E1818 exits 1 and writes no `dist/`."
// Spec: k.check-time, clause "In that project, with `test/seed.ts` and `theme.config.ts` each holding `import { defineTokens } from '@keel/ui/tokens'`, `lib/load.ts` importing `../test/seed.ts`, and `A.tsx` importing `../../lib/load.ts` and `../../theme.config.ts`, `keel check` reports two E1818 in `A.tsx`, at those two specifiers, with messages `test/seed.ts imports @keel/ui/tokens, check and build time only` and `theme.config.ts imports @keel/ui/tokens, check and build time only`, and none in `test/seed.ts`, `theme.config.ts` or `lib/load.ts`; `export { type Tokens } from '@keel/ui/tokens'` in `A.tsx` is none; without those two imports in `A.tsx` there is none."
// Seed: 1337 (fc.assert below). No `test.skip`: the cases are plain tests and fail until the build follows.
// The library half of E1818 (k.check-time Entries, Where it is reported), through `check()` over the k.looks fixture (library-looks-support.ts): a library's code file and its `src/<id>Tokens.ts`. The app half, over the binary, is packages/cli/conformance/check-time-entries-e1818.test.ts; `keel build`'s: check-time-entries-build.test.ts.
// ASSUMPTIONS: the fixture's `src/Badge.tsx` is reached from the app's route component `modules/shop/Page.tsx` through `@acme/ui` (k.boundary Following: a listed library's `exports` entry is followed to the file it gives). A diagnostic's position is the opening quote of the specifier, as E1013's. A reached exempt file `node_modules/@acme/ui/src/acmeTokens.ts` is reported at the app's own import of the chain's first file, `Page.tsx`'s `'@acme/ui'`, never in a file under `node_modules/`, with `<file>` clipped behind one `.../` until the message is at most 89 units.
import { check } from "@keel/check";
import { brandTokens } from "@keel/ui/brand";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { CHECK_CASE_BOUND } from "./check-time.ts";
import { BRAND_ONLY, ROOT, SEED, SHIPPED, app, atText, badgeSource, sourceOf } from "./library-looks-support.ts";

const e1818 = (files: ReturnType<typeof app>) =>
  check(files, { types: false, artifacts: { tokens: brandTokens } }).diagnostics.filter((d) => d.code === "E1818");
const MSG = (entry: string): string => `${entry} is check and build time only; use token names or @keel/ui/brand`;
/** `<file> imports <entry>, check and build time only`, `<file>` clipped behind one `.../` until the message is at most 89 units. */
const REACH = (file: string, entry: string): string => {
  const segs = file.split("/");
  for (let k = 0; k < segs.length; k++) {
    const shown = k === 0 ? file : `.../${segs.slice(k).join("/")}`;
    const m = `${shown} imports ${entry}, check and build time only`;
    if (m.length <= 89 || k === segs.length - 1) return m;
  }
  return "";
};
const BADGE = `${ROOT}/src/Badge.tsx`;
const PAGE = "modules/shop/Page.tsx";

describe("k.check-time: E1818 in a library", () => {
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
    "`src/<id>Tokens.ts` imported by a component a client entry reaches is one E1818, reported at the app's own import of `'@acme/ui'` with message `<file> imports @keel/ui/tokens, check and build time only`, and none in a file under `node_modules/`",
    () => {
      const badge = `import { acmeTokens } from './acmeTokens.ts'\n${badgeSource()}`;
      const files = app(BRAND_ONLY, [{ path: BADGE, source: badge }]);
      const all = e1818(files);
      expect(all).toHaveLength(1);
      expect(all[0]?.path).toBe(PAGE);
      expect(all[0]?.message).toBe(REACH(SHIPPED, "@keel/ui/tokens"));
      expect(atText(sourceOf(files, PAGE), "'@acme/ui'", all[0]?.line ?? 0, all[0]?.col ?? 0)).toBe(true);
      expect(all.filter((d) => String(d.path).startsWith("node_modules/"))).toEqual([]);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a chain through a library, `Page.tsx` to the library's `src/index.ts` to `Badge.tsx` to a `*.config.ts` file importing `@keel/ui/css`, is one E1818 at the app's own import and none inside `node_modules/`",
    () => {
      const badge = `import { cfg } from './tone.config.ts'\n${badgeSource()}`;
      const files = app(BRAND_ONLY, [
        { path: BADGE, source: badge },
        {
          path: `${ROOT}/src/tone.config.ts`,
          source: "import { contrast } from '@keel/ui/css'\nexport const cfg = contrast\n",
        },
      ]);
      const d = e1818(files);
      expect(d).toHaveLength(1);
      expect(d[0]?.path).toBe(PAGE);
      expect(d[0]?.message).toBe(REACH(`${ROOT}/src/tone.config.ts`, "@keel/ui/css"));
      expect(String(d[0]?.message).length).toBeLessThanOrEqual(89);
    },
    CHECK_CASE_BOUND,
  );

  test(
    "a type-only import of either entry in a library component is free, whatever the entry, by `import type` and by an import or export each of whose names is written `type`",
    () => {
      fc.assert(
        fc.property(
          fc.constantFrom("@keel/ui/tokens", "@keel/ui/css"),
          fc.constantFrom(
            (e: string) => `import type { Anything } from '${e}'\n`,
            (e: string) => `import { type Anything } from '${e}'\n`,
            (e: string) => `export { type Tokens } from '${e}'\n`,
            (e: string) => `export type { Tokens } from '${e}'\n`,
          ),
          (entry, write) => {
            const badge = `${write(entry)}${badgeSource()}`;
            expect(e1818(app(BRAND_ONLY, [{ path: BADGE, source: badge }]))).toEqual([]);
          },
        ),
        { seed: SEED, numRuns: 8 },
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
    "a library's test file and tool config importing either entry, with no client entry reaching them, are no E1818",
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
