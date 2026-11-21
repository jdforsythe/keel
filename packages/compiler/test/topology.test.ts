// parseTopology reads topology.ts statically (no execution).
import { describe, expect, it } from "vitest";
import { parseTopology } from "../src/internal/parseTopology.ts";

describe("parseTopology", () => {
  it("reads topology({...}) with literal modules and adapters", () => {
    const r = parseTopology(
      `import { topology } from '@keel/server'\nexport default topology({ web: { modules: ['app', 'todos'], adapter: 'client' }, 'api': { modules: [], adapter: 'node' } })\n`,
    );
    expect(r.problems.map(([, m]) => m)).toEqual([]);
    expect(r.topology).toEqual({
      web: { modules: ["app", "todos"], adapter: "client" },
      api: { modules: [], adapter: "node" },
    });
  });

  it("accepts a bare object and `satisfies`", () => {
    const r = parseTopology(`export default ({ web: { modules: ['a'], adapter: 'static' } }) satisfies object`);
    expect(r.topology).toEqual({ web: { modules: ["a"], adapter: "static" } });
  });

  it("reports what it cannot read and skips that deployable", () => {
    expect(parseTopology("export const x = 1").problems.map(([, m]) => m)).toEqual(["no default export"]);
    expect(parseTopology("export default topology(").problems.map(([, m]) => m)[0]).toMatch(/^syntax error/);
    const r = parseTopology(
      `export default topology({ a: { modules: [m], adapter: 'client' }, b: { modules: ['x'], adapter: 'lambda' } })`,
    );
    expect(r.problems.map(([, m]) => m)).toEqual([
      "a: module id is not a string literal",
      "b: needs modules: [...] and adapter: 'node' | 'static' | 'client'",
    ]);
    expect(r.topology).toEqual({ a: { modules: [], adapter: "client" } });
  });
});
