import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, it } from "vitest";
import balances from "../modules/trip/balances.ts";
import splitEqually from "../modules/trip/splitEqually.ts";

const ctx = createCtx({ mode: "sim", seed: 11 });

it("for any costs split equally among any people, the balances add up to zero", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 1, max: 12 }),
      fc.array(fc.tuple(fc.integer({ min: 1, max: 5_000_000 }), fc.nat(11)), { minLength: 1, maxLength: 20 }),
      (n, spent) => {
        const people = Array.from({ length: n }, (_, i) => ({ id: ctx.random.id("Person"), name: `P${i}` }));
        const ids = people.map((p) => p.id);
        const costs = spent.map(([cents, who]) => ({
          id: ctx.random.id("Cost"),
          title: "Cost",
          cents,
          payer: ids[who % n] ?? ids[0] ?? ctx.random.id("Person"),
          at: 0,
          shares: splitEqually(cents, ids),
        }));
        const total = balances({ people, costs }).reduce((sum, b) => sum + b.cents, 0);
        expect(total).toBe(0);
      },
    ),
    { numRuns: 200, seed: 11 },
  );
});
