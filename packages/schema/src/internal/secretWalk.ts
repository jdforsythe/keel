import { Secret } from "../Secret.ts";
import type { Node } from "./Node.ts";
import { fits } from "./fits.ts";
import { isRecord } from "./isRecord.ts";
import { variantOf } from "./variantOf.ts";

/** The most values one read visits; past it the read stops, so a huge value cannot hold it up. */
const VISITS = 1_000_000;

const text = (v: unknown): string | undefined =>
  (typeof v === "string" || typeof v === "number") && String(v) !== "" ? String(v) : undefined;

const OUTSIDE = Symbol("outside");
const WHOLE = Symbol("whole");

/** One value to read: `inside` a secret it is read under `node`, or whole when `node` is undefined. */
type Item = { readonly x: unknown; readonly node: Node | undefined; readonly inside: boolean };

/** The node a value stands under once wrappers are passed; undefined (read whole) when no union variant or member fits. */
function resolved(node: Node, x: unknown): Node | undefined {
  switch (node.kind) {
    case "optional":
    case "nullable":
      return resolved(node.inner, x);
    case "format":
      return resolved(node.base, x);
    case "union": {
      const variant = isRecord(x) ? variantOf(node, x[node.key]) : undefined;
      return variant === undefined ? undefined : resolved(variant, x);
    }
    case "anyOf": {
      const member = node.members.find((m) => fits(m, x));
      return member === undefined ? undefined : resolved(member, x);
    }
    case "json":
      return undefined;
    default:
      return node;
  }
}

/**
 * `secretValues` of `value` and whether the read was cut: `cut` is true when the read reached `visits` values
 * (1,000,000) with values left unread, which then are not in `values`. A reader that must hold every value treats a
 * cut read as holding more than it can. `visits` is for tests.
 */
export function secretWalk(value: unknown, visits: number = VISITS): { values: string[]; cut: boolean } {
  const into: string[] = [];
  const seen = new Map<object, Set<Node | symbol>>();
  const give = (v: unknown): void => {
    const t = text(v);
    if (t !== undefined) into.push(t);
  };
  // Depth-first in the order values stand, with a list rather than recursion, so a deep value cannot overflow the stack.
  const todo: Item[] = [{ x: value, node: undefined, inside: false }];
  let left = visits;
  let next = todo.pop();
  for (; next !== undefined && left > 0; next = todo.pop()) {
    left--;
    let v = next.x;
    let node = next.node;
    let inside = next.inside;
    while (Secret.is(v)) {
      node = Secret.innerOf(v);
      v = Secret.open(v);
      inside = true;
    }
    const at = inside && node !== undefined ? resolved(node, v) : undefined;
    // A `secret` node whose value is not a Secret (the marker, a raw value) is read under its inner node.
    if (at?.kind === "secret") {
      todo.push({ x: v, node: at.inner, inside });
      continue;
    }
    if (typeof v !== "object" || v === null) {
      if (inside) give(v);
      continue;
    }
    // Each object is read once per way of reading it: outside, whole, or under one node.
    const way = inside ? (at ?? WHOLE) : OUTSIDE;
    const ways = seen.get(v) ?? new Set<Node | symbol>();
    if (ways.has(way)) continue;
    ways.add(way);
    seen.set(v, ways);
    const later: Item[] = [];
    if (!inside) for (const x of Object.values(v)) later.push({ x, node: undefined, inside });
    else if (Array.isArray(v)) {
      const item = at?.kind === "array" ? at.item : undefined;
      for (const x of v) later.push({ x, node: item, inside });
    } else if (at?.kind === "record")
      for (const [k, x] of Object.entries(v))
        later.push({ x: k, node: undefined, inside }, { x, node: at.value, inside });
    else {
      const fields = at?.kind === "object" ? at.fields : undefined;
      for (const [k, x] of Object.entries(v)) {
        const field = fields !== undefined && Object.hasOwn(fields, k) ? fields[k] : undefined;
        if (field === undefined) later.push({ x: k, node: undefined, inside });
        later.push({ x, node: field, inside });
      }
    }
    for (const item of later.reverse()) todo.push(item);
  }
  return { values: into, cut: next !== undefined };
}
