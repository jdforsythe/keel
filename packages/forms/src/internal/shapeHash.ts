import type { Node } from "./Node.ts";

const replacer = (_key: string, v: unknown): unknown => (typeof v === "function" ? "fn" : v);

/** A stable base-36 FNV-1a hash of a schema descriptor tree: same shape, same hash, in any process. */
export function shapeHash(node: Node): string {
  const text = JSON.stringify(node, replacer) ?? "";
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}
