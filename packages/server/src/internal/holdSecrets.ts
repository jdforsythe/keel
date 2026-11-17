import { SCRUB_CAP } from "./SCRUB_CAP.ts";
import { SECRETS_CAP } from "./SECRETS_CAP.ts";
import { automatonOf } from "./automatonOf.ts";
import { formsOf } from "./formsOf.ts";
import { pastCap } from "./pastCap.ts";

/**
 * Per set: an upper bound of the characters of its distinct folded forms (each value's distinct forms, summed), and the
 * bound past which it is checked next.
 */
const held = new WeakMap<Set<string>, [number, number]>();

/**
 * Adds the empty string, which matches nothing, and each of `values` to `into`, a request's secret set, until the set
 * is past a cap (`pastCap`), after which it takes no more values. The set is past once it holds more than `most`
 * (100,000, `SECRETS_CAP`) distinct non-empty values, the empty string not counted, or once its forms pass `cap`
 * characters. Each new value adds the characters of its distinct written forms (`formsOf`) to the set's bound; when
 * the bound first passes `cap`, and again each time it doubles past the last check, the set is checked with
 * `automatonOf([into])`, and when that is `"over"` the set is past. Past either cap every text of the request is one
 * mark (`scrubbed`) whatever is made later. A bound alone never stops the set. `count` and `cap` are for tests and go
 * to `automatonOf`; `most` is for tests.
 */
export function holdSecrets(
  into: Set<string>,
  values: readonly string[],
  count?: { build: number; walk: number; forms: number },
  cap: number = SCRUB_CAP,
  most: number = SECRETS_CAP,
): void {
  if (pastCap.has(into)) return;
  const h = held.get(into) ?? [0, cap];
  held.set(into, h);
  into.add("");
  for (const v of values) {
    if (into.has(v)) continue;
    into.add(v);
    if (into.size - 1 > most) {
      pastCap.add(into);
      return;
    }
    for (const [f] of new Map(formsOf(v))) h[0] += f.length;
    if (h[0] <= h[1]) continue;
    if (automatonOf([into], count, cap) === "over") {
      pastCap.add(into);
      return;
    }
    h[1] = h[0] * 2;
  }
}
