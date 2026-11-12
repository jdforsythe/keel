import type { Schema } from "@keel/schema";

type Node = Schema<unknown>["node"];

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "kind" in v;

const walk = (n: Node, segs: readonly string[]): boolean => {
  const [head = "", ...rest] = segs;
  if (n.kind === "secret") return true;
  if (n.kind !== "object")
    return Object.values(n)
      .flat()
      .filter(isNode)
      .some((c) => walk(c, segs) || walk(c, rest));
  const f = Object.hasOwn(n.fields, head) ? n.fields[head] : undefined;
  return f !== undefined && walk(f, rest);
};

/**
 * True when the FormData `key` (dotted path, a trailing `[]` ignored) can reach an `s.secret` node of `root`: object
 * fields follow the path; any other node passes it to each child node (wrappers, items, values, variants, members)
 * with and without its next segment, so an array index or record key may be present or not.
 */
export function secretKey(root: Node, key: string): boolean {
  return walk(root, key.replace(/\[\]$/, "").split("."));
}
