import { createCtx } from "@keel/ctx";
import fc from "fast-check";
import { expect, it } from "vitest";
import balances from "../modules/trip/balances.ts";
import splitByParts from "../modules/trip/splitByParts.ts";
import { Cost } from "../modules/trip/Cost.schema.ts";
import people from "./people.ts";

const ctx = createCtx({ mode: "sim", seed: 11 });

it("for any costs split any way among any people, the balances add up to zero", () => {
  fc.assert(
    fc.property(
      fc.array(fc.integer({ min: 0, max: 20 }), { minLength: 1, maxLength: 8 }),
      fc.array(fc.tuple(fc.integer({ min: 1, max: 5_000_000 }), fc.nat(7)), { minLength: 1, maxLength: 20 }),
      (weights, spent) => {
        const crew = people(
          ctx,
          weights.map((_, i) => `P${i}`),
        );
        const ps = weights.map((w, i) => (i === 0 ? w + 1 : w));
        const costs = spent.map(([amount, who]) => {
          const split = splitByParts(amount, ps);
          const made = Cost.parse({
            id: ctx.random.id("Cost"),
            title: "Cost",
            amount,
            currency: "EUR",
            payer: crew[who % crew.length]?.id,
            at: 0,
            shares: crew.map((p, i) => ({ person: p.id, amount: split[i] })),
          });
          if (!made.ok) throw new Error("generated cost is invalid");
          return made.value;
        });
        const total = balances({ people: crew, costs }).reduce((sum, b) => sum + b.amount, 0);
        expect(total).toBe(0);
      },
    ),
    { numRuns: 200, seed: 11 },
  );
});
