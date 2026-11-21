// Mutation-killing tests for parseTopology.
import { describe, expect, it } from "vitest";
import { parseTopology } from "../src/internal/parseTopology.ts";

const ok = "{ modules: ['m'], adapter: 'node' }";

describe("parseTopology (mutation)", () => {
  it("rejects non-topology default exports", () => {
    const want = ["default export is not topology({...})"];
    expect(parseTopology("export default function f() {}").problems.map(([, m]) => m)).toEqual(want);
    expect(parseTopology("export default class C {}").problems.map(([, m]) => m)).toEqual(want);
    expect(parseTopology("export default interface I { a: 1 }").problems.map(([, m]) => m)).toEqual(want);
    expect(parseTopology("export default 5").problems.map(([, m]) => m)).toEqual(want);
    expect(parseTopology("export default topology(5)").problems.map(([, m]) => m)).toEqual(want);
    expect(parseTopology("export default 5").topology).toEqual({});
  });

  it("reports topology() without an object", () => {
    expect(parseTopology("export default topology()").problems.map(([, m]) => m)).toEqual([
      "topology() needs an object",
    ]);
    expect(parseTopology("export default topology(...x)").problems.map(([, m]) => m)).toEqual([
      "topology() needs an object",
    ]);
    expect(parseTopology("export default topology()").topology).toEqual({});
  });

  it("formats the syntax error with its message", () => {
    const r = parseTopology("export default topology(");
    expect(r.problems.map(([, m]) => m)).toHaveLength(1);
    expect(r.problems.map(([, m]) => m)[0]?.startsWith("syntax error: ")).toBe(true);
    expect((r.problems.map(([, m]) => m)[0] ?? "").length).toBeGreaterThan("syntax error: ".length);
    expect(r.topology).toEqual({});
  });

  it("unwraps parentheses, as and satisfies at every level", () => {
    const r = parseTopology(
      `export default topology(((({ a: (${ok}) as object, b: (${ok}) satisfies object })))) as object`,
    );
    expect(r.problems.map(([, m]) => m)).toEqual([]);
    expect(r.topology).toEqual({ a: { modules: ["m"], adapter: "node" }, b: { modules: ["m"], adapter: "node" } });
    expect(parseTopology(`export default ({ a: ${ok} }) as object`).topology).toEqual({
      a: { modules: ["m"], adapter: "node" },
    });
    expect(parseTopology(`export default { a: ${ok} } as object`).topology).toEqual({
      a: { modules: ["m"], adapter: "node" },
    });
    expect(parseTopology(`export default { a: ${ok} } satisfies object`).problems.map(([, m]) => m)).toEqual([]);
  });

  it("accepts identifier and string keys, rejects other deployable names", () => {
    expect(parseTopology(`export default { 'a-b': ${ok}, c: ${ok} }`).topology).toEqual({
      "a-b": { modules: ["m"], adapter: "node" },
      c: { modules: ["m"], adapter: "node" },
    });
    const lit = "deployable name is not a literal";
    expect(parseTopology(`export default { 1: ${ok} }`).problems.map(([, m]) => m)).toEqual([lit]);
    expect(parseTopology(`export default { [x]: ${ok} }`).problems.map(([, m]) => m)).toEqual([lit]);
    expect(parseTopology(`export default { ['a']: ${ok} }`).problems.map(([, m]) => m)).toEqual([lit]);
    expect(parseTopology("export default { ...x }").problems.map(([, m]) => m)).toEqual([lit]);
    expect(parseTopology("export default { m() {} }").problems.map(([, m]) => m)).toEqual(["m: not an object"]);
    const r = parseTopology(`export default { 1: ${ok}, a: ${ok} }`);
    expect(r.topology).toEqual({ a: { modules: ["m"], adapter: "node" } });
  });

  it("reports a deployable that is not an object", () => {
    expect(parseTopology("export default { a: 5, b }").problems.map(([, m]) => m)).toEqual([
      "a: not an object",
      "b: not an object",
    ]);
  });

  it("reports a spread or computed field, ignores an unknown one, and needs modules and adapter", () => {
    const need = "x: needs modules: [...] and adapter: 'node' | 'static' | 'client'";
    const computed = "x: a spread or a computed key; write each field out";
    expect(parseTopology("export default { x: { modules: ['m'] } }").problems.map(([, m]) => m)).toEqual([need]);
    expect(parseTopology("export default { x: { adapter: 'node' } }").problems.map(([, m]) => m)).toEqual([need]);
    expect(parseTopology("export default { x: { modules: 'm', adapter: 'node' } }").problems.map(([, m]) => m)).toEqual(
      [need],
    );
    expect(parseTopology("export default { x: { modules: ['m'], adapter: 5 } }").problems.map(([, m]) => m)).toEqual([
      need,
    ]);
    expect(parseTopology("export default { x: { modules: ['m'], adapter: node } }").problems.map(([, m]) => m)).toEqual(
      [need],
    );
    expect(
      parseTopology("export default { x: { modules: ['m'], adapter: 'lambda' } }").problems.map(([, m]) => m),
    ).toEqual([need]);
    expect(
      parseTopology("export default { x: { ['modules']: ['m'], adapter: 'node' } }").problems.map(([, m]) => m),
    ).toEqual([computed, need]);
    expect(
      parseTopology("export default { x: { modules: ['m'], ['adapter']: 'node' } }").problems.map(([, m]) => m),
    ).toEqual([computed, need]);
    expect(
      parseTopology("export default { x: { modules: ['m'], adapter: `node` } }").problems.map(([, m]) => m),
    ).toEqual([need]);
    const r = parseTopology("export default { x: { ...s, 1: 2, 'modules': ['m'], 'adapter': 'static' } }");
    expect(r.problems.map(([, m]) => m)).toEqual([computed]);
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
    expect(r.problems.map(([, m]) => m)).toEqual([
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
