// k.security, Rules "So is any `#` specifier (no `package.json` is read)."
// Seed: 1337.
// Scope as E1576 (security-e1576.test.ts): a file outside `packages/`, `node_modules/` and `.keel/`, tests included.
// Pending: not implemented yet.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const IMPORT = "import x from '#internal/y'\nexport default x\n";
const DYNAMIC = "export const m = () => import('#internal/y')\n";
const REEXPORT = "export * from '#internal/y'\n";

const codes = (path: string, source: string) =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1576");

describe("k.security: E1576 `#` specifiers", () => {
  test("`import x from '#internal/y'` in app code is one E1576", () => {
    expect(codes("modules/a/x.ts", IMPORT)).toHaveLength(1);
  });

  test("a `#`-prefixed dynamic `import()` in app code is one E1576", () => {
    expect(codes("modules/a/x.ts", DYNAMIC)).toHaveLength(1);
  });

  test("a `#`-prefixed re-export in app code is one E1576", () => {
    expect(codes("modules/a/x.ts", REEXPORT)).toHaveLength(1);
  });

  test("the same `#` specifiers in `packages/std-x/src/a.ts` are not E1576", () => {
    expect(codes("packages/std-x/src/a.ts", IMPORT)).toEqual([]);
    expect(codes("packages/std-x/src/a.ts", DYNAMIC)).toEqual([]);
    expect(codes("packages/std-x/src/a.ts", REEXPORT)).toEqual([]);
  });

  test("property: any `#` specifier is one E1576 in app code and none under `packages/`", () => {
    const seg = fc.stringMatching(/^[a-z]{2,8}$/);
    fc.assert(
      fc.property(seg, seg, (a, b) => {
        const src = `import * as m from '#${a}/${b}'\nexport default m\n`;
        expect(codes("modules/a/x.ts", src)).toHaveLength(1);
        expect(codes("test/a.test.ts", src)).toHaveLength(1);
        expect(codes("packages/p/src/a.ts", src)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});
