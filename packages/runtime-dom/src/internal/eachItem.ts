/** A DOM node of any realm (the server's document is not the global one). */
const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "nodeType" in v;

/**
 * Each item of content `v` in order, to `put`: a node as it is, an array flattened (a prop call returning several
 * nodes), `null`, `undefined` and booleans skipped, anything else as its string.
 */
export function eachItem(v: unknown, put: (x: Node | string) => void): void {
  if (Array.isArray(v)) for (const x of v) eachItem(x, put);
  else if (isNode(v)) put(v);
  else if (v !== null && v !== undefined && v !== true && v !== false) put(`${v}`);
}
