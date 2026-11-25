import type { Infer } from "@keel/schema";
import type { Trip } from "./Trip.schema.ts";

/** Each person's balance in cents: what they paid minus what they owe. Positive is owed to them. */
export default function balances(t: Infer<typeof Trip>): { person: string; cents: number }[] {
  return t.people.map((p) => ({
    person: p.id,
    cents:
      t.costs.reduce((sum, c) => sum + (c.payer === p.id ? c.cents : 0), 0) -
      t.costs.reduce((sum, c) => sum + c.shares.reduce((n, sh) => n + (sh.person === p.id ? sh.cents : 0), 0), 0),
  }));
}
