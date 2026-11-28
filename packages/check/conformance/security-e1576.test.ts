// k.security, Rules "E1576 a `@keel/*` internal entry (a specifier with an `internal` path segment) named by an import, re-export, or literal `import()` or `require` in a file outside `packages/`, `node_modules/` and `.keel/`, tests included: internal entries are kernel and stdlib seams such as the server state runner (fix: none)."
// Spec: k.security, clause "`import { serverState } from '@keel/store/internal'` in `modules/a/x.ts`, `import('@keel/router/internal')` in `test/a.test.ts` and `export * from '@keel/std-jobs/tools/internal'` are each one E1576; the first in `packages/std-x/src/a.ts` or `node_modules/@keel/std-x/a.ts`, and `import '@keel/router/match'`, are not."
// Seed: 1337.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const IMPORT = "import { serverState } from '@keel/store/internal'\nexport const s = serverState\n";
const DYNAMIC = "export const m = () => import('@keel/router/internal')\n";
const REEXPORT = "export * from '@keel/std-jobs/tools/internal'\n";

const codes = (path: string, source: string) =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1576");

describe("k.security: E1576", () => {
  test("`import { serverState } from '@keel/store/internal'` in `modules/a/x.ts` is one E1576", () => {
    expect(codes("modules/a/x.ts", IMPORT)).toHaveLength(1);
  });

  test("`import('@keel/router/internal')` in `test/a.test.ts` is one E1576", () => {
    expect(codes("test/a.test.ts", DYNAMIC)).toHaveLength(1);
  });

  test("`export * from '@keel/std-jobs/tools/internal'` is one E1576", () => {
    expect(codes("modules/a/x.ts", REEXPORT)).toHaveLength(1);
  });

  test("the same import in `packages/std-x/src/a.ts` is not E1576", () => {
    expect(codes("packages/std-x/src/a.ts", IMPORT)).toEqual([]);
  });

  test("the same import in `node_modules/@keel/std-x/a.ts` is not E1576", () => {
    expect(codes("node_modules/@keel/std-x/a.ts", IMPORT)).toEqual([]);
  });

  test("`import '@keel/router/match'` is not E1576", () => {
    expect(codes("modules/a/x.ts", "import '@keel/router/match'\n")).toEqual([]);
  });

  test("E1576: a type-only import of an internal entry is reported", () => {
    expect(
      codes("modules/a/x.ts", "import type { ServerState } from '@keel/store/internal'\nexport type T = ServerState\n"),
    ).toHaveLength(1);
  });

  test("E1576: a literal `require` of an internal entry is reported", () => {
    expect(codes("modules/a/x.ts", "const m = require('@keel/store/internal')\nexport default m\n")).toHaveLength(1);
  });

  test("E1576: a named re-export from an internal entry is reported", () => {
    expect(codes("modules/a/x.ts", "export { serverState } from '@keel/store/internal'\n")).toHaveLength(1);
  });

  test("E1576: a file under `.keel/` is not reported", () => {
    expect(codes(".keel/gen/a.ts", IMPORT)).toEqual([]);
  });

  test("E1576: a test file is reported", () => {
    expect(codes("test/a.test.ts", IMPORT)).toHaveLength(1);
  });

  test("property: any `@keel/<pkg>` specifier with an `internal` path segment is one E1576 outside `packages/`, `node_modules/` and `.keel/`, none inside", () => {
    const seg = fc.stringMatching(/^[a-z]{2,8}$/);
    fc.assert(
      fc.property(seg, fc.array(seg, { maxLength: 2 }), (pkg, tail) => {
        const spec = `@keel/${pkg}/internal${tail.length > 0 ? `/${tail.join("/")}` : ""}`;
        const src = `import * as m from '${spec}'\nexport default m\n`;
        expect(codes("modules/a/x.ts", src)).toHaveLength(1);
        expect(codes("packages/p/src/a.ts", src)).toEqual([]);
        expect(codes("node_modules/@keel/p/a.ts", src)).toEqual([]);
        expect(codes(".keel/a.ts", src)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("E1576: carries no fix", () => {
    const [d] = codes("modules/a/x.ts", IMPORT);
    expect(d).toBeDefined();
    expect(d?.fix).toBeUndefined();
  });
});
