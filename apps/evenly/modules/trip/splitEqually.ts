import type { Infer } from "@keel/schema";
import type { Person } from "./Person.schema.ts";
import type { Share } from "./Share.schema.ts";

/** Divides `cents` among `people`; the first `cents mod n` people owe one cent more, so the shares add up to `cents` exactly. */
export default function splitEqually(
  cents: number,
  people: readonly Infer<typeof Person>["id"][],
): Infer<typeof Share>[] {
  const base = Math.floor(cents / people.length);
  const extra = cents - base * people.length;
  return people.map((person, i) => ({ person, cents: i < extra ? base + 1 : base }));
}
