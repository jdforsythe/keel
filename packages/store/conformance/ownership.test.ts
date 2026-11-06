// Spec: k.store Ownership, runtime form of E1301 (undeclared transaction -> err store.undeclared). Seed 1337.
// E1301 static form and E1302 (purity) are checker rules; untestable here.
import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { scope } from "@keel/reactive";
import { tx } from "@keel/store";
import { itemArb, makeCart, opts } from "./fixtures";

describe("k.store: ownership", () => {
  it("E1301: tx with an undeclared transaction inside a scope that called uses([...]) returns err store.undeclared and leaves state and log unchanged", () => {
    fc.assert(
      fc.property(itemArb, (item) => {
        const k = makeCart();
        let code: string | undefined;
        let declaredOk: boolean | undefined;
        scope(() => {
          k.cart.uses([k.add]);
          const before = JSON.stringify([k.cart.snapshot(), k.cart.log()]);
          const r = tx(k.clear, {});
          code = r.ok ? undefined : r.error.code;
          expect(JSON.stringify([k.cart.snapshot(), k.cart.log()])).toBe(before);
          declaredOk = tx(k.add, { item }).ok;
        });
        expect(code).toBe("store.undeclared");
        expect(declaredOk).toBe(true);
        expect(k.cart.get("items")).toEqual([item]);
      }),
      opts,
    );
  });

  it("Declarations are not enforced outside any scope", () => {
    const k = makeCart();
    expect(tx(k.clear, {}).ok).toBe(true);
  });
});
