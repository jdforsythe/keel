import { SCRUB_CAP } from "./SCRUB_CAP.ts";
import { automatonOf } from "./automatonOf.ts";
import { formsOf } from "./formsOf.ts";

/**
 * Per set: an upper bound of the characters of its distinct folded forms (each value's distinct forms, summed), and the
 * bound past which it is checked next, or -1 once it is over the scrub's cap.
 */
const held = new WeakMap<Set<string>, [number, number]>();

/**
 * Adds the empty string, which matches nothing, and each of `values` to `into`, a request's secret set, until the set
 * is over the scrub's cap. Each new value adds the characters of its distinct written forms (`formsOf`) to the set's
 * bound; when the bound first passes `cap`, and again each time it doubles past the last check, the set is checked
 * with `automatonOf([into])`, and once that is `"over"` no more values are added: the set's forms already pass the
 * cap, so every text of the request is one mark (`scrubbed`) whatever is made later. A bound alone never stops the set.
 * `count` and `cap` are for tests and go to `automatonOf`.
 */
export function holdSecrets(
  into: Set<string>,
  values: readonly string[],
  count?: { build: number; walk: number; forms: number },
  cap: number = SCRUB_CAP,
): void {
  const h = held.get(into) ?? [0, cap];
  held.set(into, h);
  into.add("");
  for (const v of values) {
    if (h[1] < 0) return;
    if (into.has(v)) continue;
    into.add(v);
    for (const [f] of new Map(formsOf(v))) h[0] += f.length;
    if (h[0] > h[1]) h[1] = automatonOf([into], count, cap) === "over" ? -1 : h[0] * 2;
  }
}
