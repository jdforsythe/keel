import { Secret } from "../Secret.ts";

const walk = (x: unknown, seen: Set<unknown>, into: string[]): void => {
  if (Secret.is(x)) {
    const v = Secret.open(x);
    if (typeof v === "string" || typeof v === "number") {
      if (String(v) !== "") into.push(String(v));
    } else walk(v, seen, into);
    return;
  }
  if (typeof x !== "object" || x === null || seen.has(x)) return;
  seen.add(x);
  const items: readonly unknown[] = Object.values(x);
  for (const v of items) walk(v, seen, into);
};

/**
 * The revealed value of each `Secret` anywhere under `value` (object fields, array items, at any depth), as a string:
 * a string as is, a number as `String()` gives it. The empty string and a boolean are left out: `true` and
 * `false` stand in every log, and marking them hides nothing. A secret holding an object or array gives no string of
 * its own; the secrets inside it are read.
 */
export function secretValues(value: unknown): string[] {
  const into: string[] = [];
  walk(value, new Set(), into);
  return into;
}
