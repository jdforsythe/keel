import { createCtx } from "@keel/ctx";
import { explore, properties } from "@keel/testing";
import { expect, it } from "vitest";
import { addCost } from "../modules/trip/addCost.ts";
import { addPerson } from "../modules/trip/addPerson.ts";
import balances from "../modules/trip/balances.ts";
import { Cost } from "../modules/trip/Cost.schema.ts";
import splitByParts from "../modules/trip/splitByParts.ts";
import people from "./people.ts";

const ctx = createCtx({ mode: "sim", seed: 7 });
const [ana, ben, cy] = people(ctx, ["Ana", "Ben", "Cy"]);
if (ana === undefined || ben === undefined || cy === undefined) throw new Error("three people expected");

const cost = (amount: number, payer: typeof ana, currency: "EUR" | "USD" = "EUR") => {
  const split = splitByParts(amount, [1, 1]);
  const made = Cost.parse({
    id: ctx.random.id("Cost"),
    title: "Dinner",
    amount,
    currency,
    payer: payer.id,
    at: 0,
    shares: [
      { person: ana.id, amount: split[0] },
      { person: ben.id, amount: split[1] },
    ],
  });
  if (!made.ok) throw new Error("fixture cost is invalid");
  return made.value;
};

it("every transaction keeps the trip's invariants over generated states", async () => {
  await properties(addPerson, { runs: 100, seed: 7 });
  await properties(addCost, { runs: 100, seed: 7 });
});

it("every state reachable by adding people and costs keeps the invariants, and its balances add up to zero", () => {
  const reached = explore([addPerson, addCost], {
    from: { people: [ana, ben], costs: [] },
    depth: 3,
    payloads: {
      "trip.addPerson": [{ person: cy }],
      "trip.addCost": [{ cost: cost(1000, ana) }, { cost: cost(1001, ben) }, { cost: cost(500, ben, "USD") }],
    },
  });
  expect(reached.states.length).toBeGreaterThan(4);
  for (const state of reached.states) expect(balances(state).reduce((sum, b) => sum + b.amount, 0)).toBe(0);
});
