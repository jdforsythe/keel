// Spec: k.scaffold, Rules "E1352 id violates naming: route, store, and transaction ids are dotted lowerCamel segments prefixed by the module id; components PascalCase"
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED, errText, fresh, lowerName, pascalName, scaffoldRaw, snap } from "./fixtures.ts";

// seed 1337
describe("E1352", () => {
  it("a component name that is not PascalCase reports E1352 and writes nothing; PascalCase is clean", () => {
    fc.assert(
      fc.property(lowerName, pascalName, (bad, good) => {
        const f = fresh();
        const before = snap(f);
        const r = scaffoldRaw("component", { id: `orders/${bad}` }, f);
        expect(r.ok).toBe(false);
        expect(errText(r)).toContain("E1352");
        expect(snap(f)).toBe(before);
        expect(scaffoldRaw("component", { id: `orders/${good}` }, f).ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("a store id without the module prefix or with non-lowerCamel segments reports E1352", () => {
    fc.assert(
      fc.property(lowerName, pascalName, (n, P) => {
        for (const id of [n, `orders.${P}`, `orders.${n}_x`, `orders..${n}`]) {
          expect(errText(scaffoldRaw("store", { id }, fresh())), id).toContain("E1352");
        }
        expect(scaffoldRaw("store", { id: `orders.${n}` }, fresh()).ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
  it("a route id without the module prefix or with non-lowerCamel segments reports E1352", () => {
    fc.assert(
      fc.property(lowerName, pascalName, (n, P) => {
        for (const id of [n, `orders.${P}`, `${P}.${n}`]) {
          expect(errText(scaffoldRaw("route", { id, path: "/x" }, fresh())), id).toContain("E1352");
        }
        expect(scaffoldRaw("route", { id: `orders.${n}`, path: "/x" }, fresh()).ok).toBe(true);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
