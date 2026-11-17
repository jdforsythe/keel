import { Secret } from "../Secret.ts";

/** The most values one read visits; past it the read stops, so a huge value cannot hold it up. */
const VISITS = 1_000_000;

const text = (v: unknown): string | undefined =>
  (typeof v === "string" || typeof v === "number") && String(v) !== "" ? String(v) : undefined;

/**
 * The revealed strings and numbers of each `Secret` anywhere under `value` (object fields, array items, at any depth),
 * as strings: a string as is, a number as `String()` gives it. Inside a secret, every string and number at any depth
 * of its objects and arrays is one. The empty string and a boolean are left out: `true` and `false` stand in every log,
 * and marking them hides nothing. Each object is read once, so a value that holds itself ends, and one read visits at
 * most 1,000,000 values (more than a 1 MiB JSON body can hold), so a huge value ends too; past that, nothing more is
 * read.
 */
export function secretValues(value: unknown): string[] {
  const into: string[] = [];
  const seen = new Set<unknown>();
  // Depth-first in the order values stand, with a list rather than recursion, so a deep value cannot overflow the stack.
  const todo: { x: unknown; inside: boolean }[] = [{ x: value, inside: false }];
  let visits = 0;
  for (let next = todo.pop(); next !== undefined && visits < VISITS; next = todo.pop()) {
    visits++;
    let v = next.x;
    let inside = next.inside;
    while (Secret.is(v)) {
      v = Secret.open(v);
      inside = true;
    }
    const t = inside ? text(v) : undefined;
    if (t !== undefined) into.push(t);
    if (typeof v !== "object" || v === null || seen.has(v)) continue;
    seen.add(v);
    const items: readonly unknown[] = Object.values(v);
    for (let i = items.length - 1; i >= 0; i--) todo.push({ x: items[i], inside });
  }
  return into;
}
