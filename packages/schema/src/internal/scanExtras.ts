import type { Issue } from "./Issue.ts";
import { hasProtoKey } from "./hasProtoKey.ts";

type Path = (string | number)[];

/** Report rule `type` at every object under undeclared data that carries an own prototype key, at any depth. */
export function scanExtras(x: unknown, path: Path, issues: Issue[], seen: Set<object> = new Set()): void {
  if (typeof x !== "object" || x === null || seen.has(x)) return;
  seen.add(x);
  if (Array.isArray(x)) {
    for (const [i, item] of x.entries()) scanExtras(item, [...path, i], issues, seen);
    return;
  }
  if (hasProtoKey(x)) {
    issues.push({ path, rule: "type" });
    return;
  }
  for (const [k, v] of Object.entries(x)) scanExtras(v, [...path, k], issues, seen);
}
