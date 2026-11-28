import { nodeOf } from "../../unsafe/nodeOf.ts";

/**
 * Each item of content `v` in order, to `put`: a node as it is, an array flattened (a prop call returning several
 * nodes), `null`, `undefined` and booleans skipped, anything else as its string.
 */
export function eachItem(v: unknown, put: (x: Node | string) => void): void {
  const node = nodeOf(v);
  if (Array.isArray(v)) for (const x of v) eachItem(x, put);
  else if (node !== undefined) put(node);
  else if (v !== null && v !== undefined && v !== true && v !== false) put(`${v}`);
}
