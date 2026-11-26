// Spec: k.reactive, clause "Outside every scope, `const r = scope(() => undefined)` has `r.parent` undefined; a store `r.run(() => store(S, { n: 0 }, { id: 'm.a' }))` makes from inside `c.run(...)`, `c` a scope made outside every scope, is listed by `stores()` outside every scope after `c.dispose()`, and after `r.dispose()` it is not."
// The store half of this clause lives here: @keel/reactive's conformance may not import @keel/store (dependency order).
// Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, stores } from "@keel/store";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const S = s.object({ n: s.number() });
const ident = fc.stringMatching(/^[a-z]{3,8}$/);

describe("k.reactive: module roots own the stores they make", () => {
  it("a store made by `r.run(...)` from inside `c.run(...)` is listed by `stores()` outside every scope after `c.dispose()`, and after `r.dispose()` it is not", () => {
    const r = scope(() => undefined);
    const c = scope(() => undefined);
    try {
      c.run(() => r.run(() => store(S, { n: 0 }, { id: "m.a" })));
      expect(stores().has("m.a")).toBe(true);
      c.dispose();
      expect(stores().has("m.a")).toBe(true);
      r.dispose();
      expect(stores().has("m.a")).toBe(false);
    } finally {
      c.dispose();
      r.dispose();
    }
  });

  it("property: for any module and store id, the root's store outlives the running scope and ends with the root", () => {
    fc.assert(
      fc.property(ident, ident, (mod, name) => {
        const id = `${mod}.${name}`;
        const r = scope(() => undefined);
        const c = scope(() => undefined);
        try {
          expect(r.parent).toBeUndefined();
          c.run(() => r.run(() => store(S, { n: 0 }, { id })));
          expect(stores().has(id)).toBe(true);
          c.dispose();
          expect(stores().has(id)).toBe(true);
          r.dispose();
          expect(stores().has(id)).toBe(false);
        } finally {
          c.dispose();
          r.dispose();
        }
      }),
      { seed: SEED, numRuns: 50 },
    );
  });
});
