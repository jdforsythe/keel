// Spec: k.store, clause "`payloads` maps each transaction declared on a store to that transaction's `schema` and holds no other name." (rfc:0070)
// Seed 1337.
import { scope } from "@keel/reactive";
import { s } from "@keel/schema";
import { store, transaction } from "@keel/store";
import fc from "fast-check";
import { expect, test } from "vitest";
import { Cart, Item, opts } from "./fixtures";

test("payloads maps each declared transaction name to its schema and holds no other name", () => {
  fc.assert(
    fc.property(fc.uniqueArray(fc.stringMatching(/^[a-z]{1,8}$/), { maxLength: 8 }), (names) => {
      const sc = scope(() => {
        const cart = store(Cart, { items: [] });
        const made: { name: string; schema: unknown }[] = [];
        for (const [i, n] of names.entries()) {
          const t =
            i % 2 === 0
              ? transaction(cart, `cart.${n}`, Item, (st) => st)
              : transaction(cart, `cart.${n}`, s.object({ n: s.int() }), (st) => st);
          made.push({ name: t.name, schema: t.schema });
        }
        expect([...cart.payloads.keys()].sort()).toEqual(names.map((n) => `cart.${n}`).sort());
        for (const t of made) expect(cart.payloads.get(t.name)).toBe(t.schema);
      });
      sc.dispose();
    }),
    opts,
  );
});
