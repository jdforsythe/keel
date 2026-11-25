import type { Infer } from "@keel/schema";
import type { Person } from "./Person.schema.ts";

/** The name of the person with `id`, or an empty string when the trip has none. */
export default function nameOf(people: readonly Infer<typeof Person>[], id: string): string {
  return people.find((p) => p.id === id)?.name ?? "";
}
