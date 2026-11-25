import { transaction } from "@keel/store";
import { AddCostPayload } from "./AddCostPayload.schema.ts";
import { trip } from "./trip.ts";

export const addCost = transaction(trip, "trip.addCost", AddCostPayload, (t, p) =>
  t.costs.some((c) => c.id === p.cost.id) ||
  !t.people.some((q) => q.id === p.cost.payer) ||
  !p.cost.shares.every((sh) => t.people.some((q) => q.id === sh.person))
    ? t
    : { ...t, costs: [...t.costs, p.cost] },
);
