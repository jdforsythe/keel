import { s } from "@keel/schema";
import { Cost } from "./Cost.schema.ts";
import { Person } from "./Person.schema.ts";

/** The whole trip: its people and every cost so far. Balances are read from the costs, never stored. */
export const Trip = s.object({
  people: s.array(Person),
  costs: s.array(Cost),
});
