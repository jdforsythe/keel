import { s } from "@keel/schema";
import { transaction, tx } from "@keel/store";
import fc from "fast-check";
// Spec: k.errors, clause "A throwing transaction leaves `snapshot()` and `log()` equal to their values before the call."
// k.errors Seed 1337.
import { describe, expect, it } from "vitest";
import { applyOp, inScope, makeCart, opArb, opts } from "./fixtures";

describe("k.store: throwing transaction", () => {
  it("A throwing transaction leaves snapshot() and log() equal to their values before the call", () => {
    fc.assert(
      fc.property(fc.array(opArb, { maxLength: 15 }), (ops) => {
        const k = makeCart();
        const boom = inScope(() =>
          transaction(k.cart, "cart.boom", s.object({}), () => {
            throw new Error("boom");
          }),
        );
        for (const op of ops) applyOp(k, op);
        const snap = JSON.stringify(k.cart.snapshot());
        const log = JSON.stringify(k.cart.log());
        try {
          tx(boom, {});
        } catch {
          // propagation is allowed; only the unchanged state is specified
        }
        expect(JSON.stringify(k.cart.snapshot())).toBe(snap);
        expect(JSON.stringify(k.cart.log())).toBe(log);
        expect(applyOp(k, { kind: "clear" }).ok).toBe(true);
      }),
      opts,
    );
  });
});
