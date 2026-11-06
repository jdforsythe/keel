import fc from "fast-check";
// Spec: k.store API, "cart.log() ordered entries { name, payload, at, id }". Seed 1337.
import { describe, expect, it } from "vitest";
import { applyOp, makeCart, opArb, opts } from "./fixtures";

describe("k.store: log", () => {
  it("Log entries are ordered by commit and carry name and payload", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const k = makeCart();
        for (const op of ops) applyOp(k, op);
        const names = k.cart.log().map((e) => e.name);
        const expected = ops.map((op) =>
          op.kind === "add" ? k.add.name : op.kind === "pop" ? k.pop.name : k.clear.name,
        );
        expect(names).toEqual(expected);
      }),
      opts,
    );
  });

  it("Log entry ids are unique", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const k = makeCart();
        for (const op of ops) applyOp(k, op);
        const ids = k.cart.log().map((e) => e.id);
        expect(new Set(ids).size).toBe(ids.length);
      }),
      opts,
    );
  });

  it("Log entry at comes from the injected clock, in order", () => {
    let t = 100;
    const k = makeCart({ clock: () => (t += 7) });
    applyOp(k, { kind: "add", item: { sku: "a", qty: 1 } });
    applyOp(k, { kind: "pop" });
    const ats = k.cart.log().map((e) => e.at);
    expect(ats).toEqual([107, 114]);
  });

  it("Log entry at is non-decreasing with the default clock", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 20 }), (ops) => {
        const k = makeCart();
        for (const op of ops) applyOp(k, op);
        const ats = k.cart.log().map((e) => e.at);
        expect([...ats].sort((x, y) => x - y)).toEqual(ats);
      }),
      opts,
    );
  });
});
