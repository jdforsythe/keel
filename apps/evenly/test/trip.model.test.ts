import { createCtx } from "@keel/ctx";
import { explore, properties } from "@keel/testing";
import { expect, it } from "vitest";
import { addCost } from "../modules/trip/addCost.ts";
import { addPerson } from "../modules/trip/addPerson.ts";
import balances from "../modules/trip/balances.ts";
import splitEqually from "../modules/trip/splitEqually.ts";

const ctx = createCtx({ mode: "sim", seed: 7 });
const ana = ctx.random.id("Person");
const ben = ctx.random.id("Person");
const cy = ctx.random.id("Person");
const cost = (cents: number, payer: typeof ana) => ({
  id: ctx.random.id("Cost"),
  title: "Dinner",
  cents,
  payer,
  at: 0,
  shares: splitEqually(cents, [ana, ben]),
});

it("a person added twice is kept once, and every transaction keeps the trip's invariants", async () => {
  await properties(addPerson, { runs: 100, seed: 7 });
  await properties(addCost, { runs: 100, seed: 7 });
});

it("every state reachable by adding people and costs keeps the trip's invariants", () => {
  const from = {
    people: [
      { id: ana, name: "Ana" },
      { id: ben, name: "Ben" },
    ],
    costs: [],
  };
  const reached = explore([addPerson, addCost], {
    from,
    depth: 3,
    payloads: {
      "trip.addPerson": [{ person: { id: cy, name: "Cy" } }],
      "trip.addCost": [{ cost: cost(1000, ana) }, { cost: cost(1001, ben) }],
    },
  });
  expect(reached.states.length).toBeGreaterThan(4);
  for (const state of reached.states) {
    const total = balances(state).reduce((sum, b) => sum + b.cents, 0);
    expect(total).toBe(0);
  }
});
