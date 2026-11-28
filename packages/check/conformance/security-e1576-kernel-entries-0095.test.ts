// k.security, Rules "E1576 a `@keel/*` internal entry (a specifier with an `internal` path segment) named by an import, re-export, or literal `import()` or `require` in a file outside `packages/`, `node_modules/` and `.keel/`, tests included: internal entries are kernel and stdlib seams such as the server state runner (fix: none)."
// Seed: 1337.
// No Conformance sentence names the kernel-only entries `@keel/server/internal/dom`, `@keel/server/internal/start` and
// `@keel/compiler/internal/entry/*` (ADR-0118 D6: "E1576 covers them with no rule change"); this file holds the rule over those specifiers.
import { check } from "@keel/check";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED } from "./support.ts";

const ENTRIES = [
  "@keel/server/internal/dom",
  "@keel/server/internal/start",
  "@keel/compiler/internal/entry/resume",
  "@keel/compiler/internal/entry/island",
] as const;

const codes = (path: string, source: string) =>
  check([{ path, source }], { types: false }).diagnostics.filter((d) => d.code === "E1576");

describe("k.security: E1576 over the kernel-only entries", () => {
  for (const entry of ENTRIES) {
    test(`an import of \`${entry}\` in \`modules/a/x.ts\` is one E1576`, () => {
      expect(codes("modules/a/x.ts", `import * as m from '${entry}'\nexport default m\n`)).toHaveLength(1);
    });
    test(`a literal \`import()\` of \`${entry}\` in \`test/a.test.ts\` is one E1576`, () => {
      expect(codes("test/a.test.ts", `export const m = () => import('${entry}')\n`)).toHaveLength(1);
    });
    test(`a re-export of \`${entry}\` in \`modules/a/x.ts\` is one E1576`, () => {
      expect(codes("modules/a/x.ts", `export * from '${entry}'\n`)).toHaveLength(1);
    });
    test(`an import of \`${entry}\` in \`packages/std-x/src/a.ts\` or \`node_modules/@keel/std-x/a.ts\` is not E1576`, () => {
      const src = `import * as m from '${entry}'\nexport default m\n`;
      expect(codes("packages/std-x/src/a.ts", src)).toEqual([]);
      expect(codes("node_modules/@keel/std-x/a.ts", src)).toEqual([]);
    });
  }

  test("property: `@keel/compiler/internal/entry/<name>` is one E1576 outside `packages/`, `node_modules/` and `.keel/`, none inside", () => {
    fc.assert(
      fc.property(fc.stringMatching(/^[a-z]{2,10}$/), (name) => {
        const src = `import * as m from '@keel/compiler/internal/entry/${name}'\nexport default m\n`;
        expect(codes("modules/a/x.ts", src)).toHaveLength(1);
        expect(codes("packages/p/src/a.ts", src)).toEqual([]);
        expect(codes("node_modules/@keel/p/a.ts", src)).toEqual([]);
        expect(codes(".keel/a.ts", src)).toEqual([]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  test("`@keel/server` and `@keel/compiler` entries without an `internal` segment are not E1576", () => {
    for (const spec of ["@keel/server", "@keel/compiler", "@keel/compiler/vite", "@keel/compiler/testing"]) {
      expect(codes("modules/a/x.ts", `import * as m from '${spec}'\nexport default m\n`)).toEqual([]);
    }
  });
});
