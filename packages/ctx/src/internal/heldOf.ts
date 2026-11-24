import { realmShared } from "./realmShared.ts";

/** The work a sim ctx family holds now (k.sim plans), in hold order, kept on the family's clock; made on first use. */
export function heldOf(clock: object): { readonly label: string }[] {
  const map = realmShared<object, { readonly label: string }[]>("keel.heldWork");
  const made = map.get(clock);
  if (made !== undefined) return made;
  const fresh: { readonly label: string }[] = [];
  map.set(clock, fresh);
  return fresh;
}
