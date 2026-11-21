// k.contract Rules E1513: `contract` reached other than by a direct call of its import (an alias, a value use, a
// destructured namespace, a re-export, a dynamic import) is E1513, so no contract escapes the static reader.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { check } from "../src/check.ts";
import type { Diagnostic, SourceFile } from "../src/index.ts";

const FILE = "modules/a/a.contract.ts";
const f = (path: string, source: string): SourceFile => ({ path, source });
const of = (files: SourceFile[]): readonly Diagnostic[] =>
  check(files, { types: false }).diagnostics.filter((d) => d.code === "E1513");
const ENTRIES = "{ 'a.home': { path: '/' } }";

describe("contract reached through an alias", () => {
  const CLEAN: Readonly<Record<string, string>> = {
    named: `import { contract } from '@keel/router/contract'\nexport const a = contract('a', ${ENTRIES})\n`,
    renamed: `import { contract as c } from '@keel/router/contract'\nexport const a = c('a', ${ENTRIES})\n`,
    namespace: `import * as r from '@keel/router/contract'\nexport const a = r.contract('a', ${ENTRIES})\n`,
    typeOnly: `import { contract } from '@keel/router/contract'\nimport type { Contract } from '@keel/router/contract'\nexport const a = contract('a', ${ENTRIES})\ntype T = typeof contract\n`,
  };
  const ESCAPE: Readonly<Record<string, string>> = {
    alias: `import { contract } from '@keel/router/contract'\nconst mk = contract\nexport const a = mk('a', ${ENTRIES})\n`,
    argument: `import { contract } from '@keel/router/contract'\nconst call = (f: unknown) => f\nexport const a = call(contract)\n`,
    shorthand: `import { contract } from '@keel/router/contract'\nconst o = { contract }\nexport const a = o.contract('a', ${ENTRIES})\n`,
    destructured: `import * as r from '@keel/router/contract'\nconst { contract: mk } = r\nexport const a = mk('a', ${ENTRIES})\n`,
    namespaceValue: `import * as r from '@keel/router/contract'\nconst mk = r.contract\nexport const a = mk('a', ${ENTRIES})\n`,
    computed: `import * as r from '@keel/router/contract'\nexport const a = r['contract']('a', ${ENTRIES})\n`,
    dynamic: `export const a = import('@keel/router/contract').then((m) => m.contract('a', ${ENTRIES}))\n`,
  };

  it("a direct call by a named, renamed or namespace import is read and is no E1513", () => {
    for (const source of Object.values(CLEAN)) expect(of([f(FILE, source)])).toEqual([]);
  });

  it("every other way to reach it is one E1513 naming the contract file", () => {
    fc.assert(
      fc.property(fc.constantFrom(...Object.keys(ESCAPE)), (name) => {
        const ds = of([f(FILE, ESCAPE[name] ?? "")]);
        expect(ds.map((d) => d.code)).toEqual(["E1513"]);
        expect(ds[0]?.message).toContain("modules/a/a.contract.ts");
      }),
      { seed: 1337, numRuns: 20 },
    );
  });

  it("a re-export from an app file is E1513 there, by name or by `*`", () => {
    for (const source of [
      "export { contract } from '@keel/router/contract'\n",
      "export { contract as mk } from '@keel/router/contract'\n",
      "export * from '@keel/router/contract'\n",
      "export * as r from '@keel/router/contract'\n",
      "import { contract } from '@keel/router/contract'\nexport { contract }\n",
    ]) {
      const ds = of([
        f("modules/a/lib.ts", source),
        f(FILE, `import { contract } from './lib.ts'\nexport const a = contract('a', ${ENTRIES})\n`),
      ]);
      expect(ds.map((d) => d.path)).toEqual(["modules/a/lib.ts"]);
    }
  });

  it("re-exporting a type only is none", () => {
    expect(of([f("modules/a/lib.ts", "export type { Contract } from '@keel/router/contract'\n")])).toEqual([]);
  });
});
