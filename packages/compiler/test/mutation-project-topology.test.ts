// Mutation-killing tests for parseTopology.
import { describe, expect, it } from "vitest";
import { parseTopology } from "../src/internal/parseTopology.ts";

const ok = "{ modules: ['m'], adapter: 'node' }";

describe("parseTopology (mutation)", () => {
  it("rejects non-topology default exports", () => {
    const want = ["default export is not topology({...})"];
    expect(parseTopology("export default function f() {}").problems).toEqual(want);
    expect(parseTopology("export default class C {}").problems).toEqual(want);
    expect(parseTopology("export default interface I { a: 1 }").problems).toEqual(want);
    expect(parseTopology("export default 5").problems).toEqual(want);
    expect(parseTopology("export default topology(5)").problems).toEqual(want);
    expect(parseTopology("export default 5").topology).toEqual({});
  });

  it("reports topology() without an object", () => {
    expect(parseTopology("export default topology()").problems).toEqual(["topology() needs an object"]);
    expect(parseTopology("export default topology(...x)").problems).toEqual(["topology() needs an object"]);
    expect(parseTopology("export default topology()").topology).toEqual({});
  });

  it("formats the syntax error with its message", () => {
    const r = parseTopology("export default topology(");
    expect(r.problems).toHaveLength(1);
    expect(r.problems[0]?.startsWith("syntax error: ")).toBe(true);
    expect((r.problems[0] ?? "").length).toBeGreaterThan("syntax error: ".length);
    expect(r.topology).toEqual({});
  });

  it("unwraps parentheses, as and satisfies at every level", () => {
    const r = parseTopology(
      `export default topology(((({ a: (${ok}) as object, b: (${ok}) satisfies object })))) as object`,
    );
    expect(r.problems).toEqual([]);
    expect(r.topology).toEqual({ a: { modules: ["m"], adapter: "node" }, b: { modules: ["m"], adapter: "node" } });
    expect(parseTopology(`export default ({ a: ${ok} }) as object`).topology).toEqual({
      a: { modules: ["m"], adapter: "node" },
    });
    expect(parseTopology(`export default { a: ${ok} } as object`).topology).toEqual({
      a: { modules: ["m"], adapter: "node" },
    });
    expect(parseTopology(`export default { a: ${ok} } satisfies object`).problems).toEqual([]);
  });

  it("accepts identifier and string keys, rejects other deployable names", () => {
    expect(parseTopology(`export default { 'a-b': ${ok}, c: ${ok} }`).topology).toEqual({
      "a-b": { modules: ["m"], adapter: "node" },
      c: { modules: ["m"], adapter: "node" },
    });
    const lit = "deployable name is not a literal";
    expect(parseTopology(`export default { 1: ${ok} }`).problems).toEqual([lit]);
    expect(parseTopology(`export default { [x]: ${ok} }`).problems).toEqual([lit]);
    expect(parseTopology(`export default { ['a']: ${ok} }`).problems).toEqual([lit]);
    expect(parseTopology("export default { ...x }").problems).toEqual([lit]);
    expect(parseTopology("export default { m() {} }").problems).toEqual(["m: not an object"]);
    const r = parseTopology(`export default { 1: ${ok}, a: ${ok} }`);
    expect(r.topology).toEqual({ a: { modules: ["m"], adapter: "node" } });
  });

  it("reports a deployable that is not an object", () => {
    expect(parseTopology("export default { a: 5, b }").problems).toEqual(["a: not an object", "b: not an object"]);
  });

  it("ignores unreadable fields but needs modules and adapter", () => {
    const need = "x: needs modules: [...] and adapter: 'node' | 'static' | 'client'";
    expect(parseTopology("export default { x: { modules: ['m'] } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { adapter: 'node' } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { modules: 'm', adapter: 'node' } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { modules: ['m'], adapter: 5 } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { modules: ['m'], adapter: node } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { modules: ['m'], adapter: 'lambda' } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { ['modules']: ['m'], adapter: 'node' } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { modules: ['m'], ['adapter']: 'node' } }").problems).toEqual([need]);
    expect(parseTopology("export default { x: { modules: ['m'], adapter: `node` } }").problems).toEqual([need]);
    const r = parseTopology("export default { x: { ...s, 1: 2, 'modules': ['m'], 'adapter': 'static' } }");
    expect(r.problems).toEqual([]);
    expect(r.topology).toEqual({ x: { modules: ["m"], adapter: "static" } });
    expect(Object.keys(parseTopology("export default { x: { modules: ['m'] } }").topology)).toEqual([]);
    expect(parseTopology("export default { x: { modules: ['m'], adapter: ('client') } }").topology).toEqual({
      x: { modules: ["m"], adapter: "client" },
    });
    expect(parseTopology("export default { x: { modules: (['m']), adapter: 'client' } }").topology).toEqual({
      x: { modules: ["m"], adapter: "client" },
    });
  });

  it("keeps string module ids and flags the others", () => {
    const r = parseTopology("export default { x: { modules: ['a', 1, b, , 'c'], adapter: 'client' } }");
    expect(r.problems).toEqual([
      "x: module id is not a string literal",
      "x: module id is not a string literal",
      "x: module id is not a string literal",
    ]);
    expect(r.topology).toEqual({ x: { modules: ["a", "c"], adapter: "client" } });
  });

  it("accepts each adapter", () => {
    for (const a of ["node", "static", "client"]) {
      expect(parseTopology(`export default { x: { modules: [], adapter: '${a}' } }`).topology).toEqual({
        x: { modules: [], adapter: a },
      });
    }
  });
});
