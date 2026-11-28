// Spec: k.expect, clause "There, `err({ code: 'keel.denied', message: 'sign in', data: null })` and `const t: KeelError<'m.t', null> = { code: 'm.t', message: 'm.t', data: null }` are one E1458 each at the object literal, message `KeelError written by hand: declare it with s.error and pass X.make(data)`; `err(keelError.denied.make({}))` is none."
// Seed 1337. Fixture source text, type pass on.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD = "import { err, keelError } from '@keel/schema'\nimport type { KeelError } from '@keel/schema'\n";
const MESSAGE = "KeelError written by hand: declare it with s.error and pass X.make(data)";

const e1458 = (stmt: string) => {
  const source = `${HEAD}${stmt}\n`;
  return {
    source,
    ds: check([M, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
      (d) => d.path === "modules/m/a.ts" && d.code === "E1458",
    ),
  };
};

describe("k.expect Made errors: a KeelError is made by make", { timeout: testTime(120_000) }, () => {
  const BAD: readonly (readonly [string, string])[] = [
    ["export const a = err({ code: 'keel.denied', message: 'sign in', data: null })", "{ code: 'keel.denied'"],
    [
      "const t: KeelError<'m.t', null> = { code: 'm.t', message: 'm.t', data: null }\nexport const b = t",
      "{ code: 'm.t'",
    ],
  ];
  for (const [stmt, at] of BAD) {
    it(`\`${stmt.split("\n")[0]}\` is one E1458 at the object literal, message \`${MESSAGE}\`, with no fix`, () => {
      const { source, ds } = e1458(stmt);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(MESSAGE);
      expect(ds[0]?.fix).toBeUndefined();
      const before = source.slice(0, source.indexOf(at)).split("\n");
      expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual({
        line: before.length,
        col: (before[before.length - 1]?.length ?? 0) + 1,
      });
    });
  }

  it("`err(keelError.denied.make({}))` is no E1458", () => {
    expect(e1458("export const a = err(keelError.denied.make({}))").ds).toEqual([]);
  });
});
