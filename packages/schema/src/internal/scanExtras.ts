import { Secret } from "../Secret.ts";
import type { Issue } from "./Issue.ts";
import { hasProtoKey } from "./hasProtoKey.ts";

type Path = (string | number)[];

/** Where a value stands under the scanned one: its key and its parent's link. */
type Link = { readonly key: string | number; readonly up: Link | undefined } | undefined;

/**
 * Report rule `type` at every object under undeclared data that carries an own prototype key or is a `Secret`, at any
 * depth, without descending into it. Walked with a list rather than recursion, so deep data cannot overflow the stack.
 */
export function scanExtras(x: unknown, path: Path, issues: Issue[]): void {
  const seen = new Set<object>();
  const todo: [unknown, Link][] = [[x, undefined]];
  for (let t = todo.pop(); t !== undefined; t = todo.pop()) {
    const [v, at] = t;
    if (typeof v !== "object" || v === null || seen.has(v)) continue;
    seen.add(v);
    if (Secret.is(v) || (!Array.isArray(v) && hasProtoKey(v))) {
      const keys: Path = [];
      for (let a = at; a !== undefined; a = a.up) keys.push(a.key);
      issues.push({ path: [...path, ...keys.reverse()], rule: "type" });
    } else
      for (const [key, c] of (Array.isArray(v) ? [...v.entries()] : Object.entries(v)).reverse())
        todo.push([c, { key, up: at }]);
  }
}
