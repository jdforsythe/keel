import type { Issue } from "./Issue.ts";
import type { Node } from "./Node.ts";
import { check } from "./check.ts";

/** True when `x` satisfies `node` (no issues). */
export function fits(node: Node, x: unknown): boolean {
  const issues: Issue[] = [];
  check(node, x, [], issues);
  return issues.length === 0;
}
