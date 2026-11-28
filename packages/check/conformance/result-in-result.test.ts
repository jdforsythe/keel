// Spec: k.attempt, clause "In `modules/m/a.ts`, with `r` typed `Result<number, E>` and `c` a `boolean`: `ok(err(T))`, `ok(r)`, `ok(c ? 1 : r)`, `ok(attempt(f, expect))` with `f` `async`, and the return type `Result<Result<number, E>, E>` are one E1459 each, at the argument or at the inner type argument, message `Result in a Result: return the inner Result itself`, with no fix; `ok(1)`, `ok({ got: r })` and `function wrap<V>(v: V) { return ok(v) }` are none."
// Seed 1337. Fixture source text, type pass on (E1459 reads the argument's type). The run-time half is packages/schema/conformance/result-in-result-run.test.ts.
import { check } from "@keel/check";
import { testTime } from "@keel/tooling/test-time";
import { describe, expect, it } from "vitest";
import { manifestFile } from "./module-support.ts";

const M = manifestFile({ id: "m", deps: [], capabilities: [], exports: [] });
const HEAD =
  "import { attempt, err, ok } from '@keel/schema'\nimport type { KeelError, Result } from '@keel/schema'\ntype E = KeelError<'m.e', null>\ndeclare const T: E\ndeclare const r: Result<number, E>\ndeclare const c: boolean\ndeclare const f: () => Promise<number>\n";
const MESSAGE = "Result in a Result: return the inner Result itself";

const e1459 = (stmt: string) => {
  const source = `${HEAD}${stmt}\n`;
  const ds = check([M, { path: "modules/m/a.ts", source }], { types: true }).diagnostics.filter(
    (d) => d.path === "modules/m/a.ts" && d.code === "E1459",
  );
  return { source, ds };
};
const posOf = (source: string, needle: string) => {
  const before = source.slice(0, source.indexOf(needle)).split("\n");
  return { line: before.length, col: (before[before.length - 1]?.length ?? 0) + 1 };
};

describe("k.attempt: a Result holds no Result (check)", { timeout: testTime(120_000) }, () => {
  const BAD: readonly (readonly [string, string, string])[] = [
    ["export const a = ok(err(T))", "err(T)", "ok(err(T))"],
    ["export const a = ok(r)", "r)", "ok(r)"],
    ["export const a = ok(c ? 1 : r)", "c ? 1 : r", "ok(c ? 1 : r)"],
    [
      "export const a = ok(attempt(f, (x) => (x instanceof RangeError ? T : undefined)))",
      "attempt(f",
      "ok(attempt(f, expect))",
    ],
    ["export type A = Result<Result<number, E>, E>", "Result<number, E>, E>", "Result<Result<number, E>, E>"],
  ];
  for (const [stmt, at, name] of BAD) {
    it(`\`${name}\` is one E1459 at the argument or the inner type argument, message \`${MESSAGE}\`, with no fix`, () => {
      const { source, ds } = e1459(stmt);
      expect(ds).toHaveLength(1);
      expect(ds[0]?.message).toBe(MESSAGE);
      expect(ds[0]?.fix).toBeUndefined();
      expect({ line: ds[0]?.line, col: ds[0]?.col }).toEqual(posOf(source, at));
    });
  }

  for (const stmt of [
    "export const a = ok(1)",
    "export const a = ok({ got: r })",
    "export function wrap<V>(v: V) { return ok(v) }",
  ]) {
    it(`\`${stmt.replace("export ", "")}\` is no E1459`, () => {
      expect(e1459(stmt).ds).toEqual([]);
    });
  }
});
