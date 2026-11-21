const isNode = (x: unknown): x is object => typeof x === "object" && x !== null;

/** Calls `visit` on every AST node under `node`, depth first. */
export function walk(node: unknown, visit: (n: object) => void, seen = new WeakSet<object>()): void {
  if (!isNode(node) || seen.has(node)) return;
  seen.add(node);
  if (!Array.isArray(node)) visit(node);
  for (const v of Array.isArray(node) ? node : Object.values(node)) walk(v, visit, seen);
}
