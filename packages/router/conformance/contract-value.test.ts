// @vitest-environment happy-dom
// Spec: k.contract, clause "`contract('a', { 'a.home': { path: '/' } })` has `kind` `keel.contract` and `module` `a`; a key `b.home` does not compile; an API id `a.x.y` throws E1513."
// Spec: k.routes, Where rules fire "| E1155 | a contract key | `contract` | contract keys |"
// Spec: RFC 0157 Proposal 1, "`contract` returns a frozen `{ kind: 'keel.contract', module, entries, href }`. It holds schemas and strings only." (RFC 0157 Proposal 1)
// Seed 1337.
// Compile-time half of each "does not compile" claim: ../unsafe/conformanceNegativeTypes.ts; the calls here are untyped.
import { contract } from "@keel/router/contract";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, thrown } from "./contract-support.ts";

const lowerId = fc.stringMatching(/^[a-z][a-zA-Z0-9]{0,7}$/);
const Out = s.object({ n: s.int() });

describe("k.contract value", () => {
  it("`contract('a', { 'a.home': { path: '/' } })` has `kind` `keel.contract` and `module` `a`", () => {
    const c = contract("a", { "a.home": { path: "/" } });
    expect(c.kind).toBe("keel.contract");
    expect(c.module).toBe("a");
    expect(Object.keys(c.entries)).toEqual(["a.home"]);
    fc.assert(
      fc.property(lowerId, lowerId, (module, name) => {
        const entries = { [`${module}.${name}`]: { path: "/x" } };
        const made = Reflect.apply(contract, undefined, [module, entries]);
        expect(made.kind).toBe("keel.contract");
        expect(made.module).toBe(module);
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("a key `b.home` in contract `a` does not compile", () => {
    const bad = () => Reflect.apply(contract, undefined, ["a", { "a.home": { path: "/" }, "b.home": { path: "/b" } }]);
    // the type half is claimed in ../unsafe/conformanceNegativeTypes.ts; `contract` throws E1155 for it
    expect(thrown(bad)?.code).toBe("E1155");
  });

  it("an API id `a.x.y` throws E1513", () => {
    const bad = () =>
      Reflect.apply(contract, undefined, ["a", { "a.x.y": { method: "GET", path: "/x", output: Out } }]);
    expect(thrown(bad)?.code).toBe("E1513");
    fc.assert(
      fc.property(lowerId, lowerId, (x, y) => {
        const e = thrown(() =>
          Reflect.apply(contract, undefined, ["a", { [`a.${x}.${y}`]: { method: "GET", path: "/x", output: Out } }]),
        );
        expect(e?.code).toBe("E1513");
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  it("an API id `a.name` with one lowerCamel segment is clean; a segment that is not lowerCamel throws E1513", () => {
    expect(thrown(() => contract("a", { "a.addItem": { method: "POST", path: "/x", output: Out } }))).toBeNull();
    for (const name of ["Add", "add_item", "add-item", "1add", ""]) {
      const e = thrown(() =>
        Reflect.apply(contract, undefined, ["a", { [`a.${name}`]: { method: "GET", path: "/x", output: Out } }]),
      );
      expect(e?.code).toBe("E1513");
    }
  });

  it("a contract is frozen and holds schemas and strings only", () => {
    const c = contract("a", {
      "a.home": { path: "/" },
      "a.list": { method: "GET", path: "/api/a", output: Out },
    });
    expect(Object.isFrozen(c)).toBe(true);
    for (const entry of Object.values(c.entries)) {
      for (const v of Object.values(entry)) expect(typeof v).not.toBe("function");
    }
  });
});
