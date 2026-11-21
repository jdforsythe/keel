import type { Schema } from "@keel/schema";

type Node = Schema<unknown>["node"];

const isNode = (v: unknown): v is Node => typeof v === "object" && v !== null && "kind" in v;
const held = new WeakMap<Node, boolean>();
/** True when the subtree holds an `s.secret` node; decided once per schema node. */
const holds = (n: Node): boolean => {
  let v = held.get(n);
  if (v === undefined) {
    v =
      n.kind === "secret" ||
      Object.values(n.kind === "object" ? n.fields : n)
        .flat()
        .some((c) => isNode(c) && holds(c));
    held.set(n, v);
  }
  return v;
};
/**
 * True when the FormData `key` (dotted path, a trailing `[]` ignored) can reach an `s.secret` node of `root`. The key
 * follows object fields by name through optional and nullable wrappers; at any other node (secret, array, record,
 * union, anyOf, format) whose subtree holds a secret the key is secret, whatever segments remain. A schema with no
 * secret answers at once, any key in time linear in its length.
 */
export function secretKey(root: Node, key: string): boolean {
  let n: Node | undefined = root;
  for (const seg of `${key.replace(/\[\]$/, "")}.`.split(".")) {
    while (n?.kind === "optional" || n?.kind === "nullable") n = n.inner;
    if (n === undefined || !holds(n)) return false;
    if (n.kind !== "object") return true;
    n = Object.hasOwn(n.fields, seg) ? n.fields[seg] : undefined;
  }
  return false;
}
