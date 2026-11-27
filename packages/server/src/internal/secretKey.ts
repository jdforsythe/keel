import type { Schema } from "@keel/schema";

type Node = Schema<unknown>["node"];

/** The nodes directly under `n`. */
const childrenOf = (n: Node): readonly Node[] => {
  switch (n.kind) {
    case "object":
      return Object.values(n.fields);
    case "array":
      return [n.item];
    case "record":
      return [n.value];
    case "union":
      return n.variants;
    case "anyOf":
      return n.members;
    case "nullable":
    case "optional":
    case "secret":
      return [n.inner];
    case "format":
      return [n.base];
    default:
      return [];
  }
};
const held = new WeakMap<Node, boolean>();
/** True when the subtree holds an `s.secret` node; decided once per schema node. */
const holds = (n: Node): boolean => {
  let v = held.get(n);
  if (v === undefined) {
    v = n.kind === "secret" || childrenOf(n).some(holds);
    held.set(n, v);
  }
  return v;
};

/** True when `n`, past optional, nullable and format wrappers, holds no fields of its own to name. */
const leaf = (n: Node): boolean => {
  const inner = n.kind === "optional" || n.kind === "nullable" ? n.inner : n.kind === "format" ? n.base : undefined;
  return inner === undefined ? n.kind !== "object" && n.kind !== "record" : leaf(inner);
};

/**
 * The nodes a path continues into at `n`, each with the segment index it continues from: wrappers are looked through,
 * a union or `anyOf` fans out to its parts and an object takes its field by name; a
 * record is read in `secretKey` itself.
 */
const through = (n: Node, segs: readonly string[], i: number): readonly (readonly [Node, number])[] => {
  switch (n.kind) {
    case "optional":
    case "nullable":
      return [[n.inner, i]];
    case "format":
      return [[n.base, i]];
    case "union":
      return n.variants.map((v) => [v, i] as const);
    case "anyOf":
      return n.members.map((v) => [v, i] as const);
    case "object": {
      const seg = segs[i];
      const f = seg !== undefined && Object.hasOwn(n.fields, seg) ? n.fields[seg] : undefined;
      return f === undefined ? [] : [[f, i + 1]];
    }
    default:
      return [];
  }
};

/**
 * True when the FormData `key` (dotted path, a trailing `[]` ignored) can reach an `s.secret` node of `root`. The key
 * follows an object's field by name, a record's value for any one or more segments (a record key may hold dots), each variant of a union and each member of an
 * `anyOf`, through optional, nullable and format wrappers. It is secret when some path reaches an `s.secret` node,
 * ends at a node holding one, or meets an array whose item holds one (an array's form values are leaves, so the key
 * is the array). A record's key may hold dots, so its value is tried at each later segment index, and at the key's
 * end only right after the record or as a leaf (a dotted key that ends at an object's own name is no form value).
 * A node is tried at most once per segment index, and a record's value is tried from each index once however many
 * paths reach it, so the time is linear in the key's length times the schema's size. A schema with no secret answers
 * at once.
 */
export function secretKey(root: Node, key: string): boolean {
  if (!holds(root)) return false;
  const segs = key.replace(/\[\]$/, "").split(".");
  const failed = new Map<Node, Set<number>>();
  const reach = (n: Node, i: number): boolean => {
    if (!holds(n)) return false;
    if (n.kind === "secret" || n.kind === "array") return true;
    const open =
      n.kind === "optional" || n.kind === "nullable" || n.kind === "format" || n.kind === "union" || n.kind === "anyOf";
    if (i >= segs.length && !open) return true;
    if (failed.get(n)?.has(i)) return false;
    const ok = n.kind === "record" ? anyFrom(n.value, i + 1) : through(n, segs, i).some(([c, at]) => reach(c, at));
    if (!ok) failed.set(n, (failed.get(n) ?? new Set<number>()).add(i));
    return ok;
  };
  // Per record value: the least index from which it was tried at every later index, all failing.
  const tried = new Map<Node, number>();
  function anyFrom(v: Node, j: number): boolean {
    const stop = tried.get(v) ?? segs.length + 1;
    tried.set(v, Math.min(stop, j));
    for (let at = j; at < stop && at <= segs.length; at++) {
      if (at === segs.length && at !== j && !leaf(v)) break;
      if (reach(v, at)) return true;
    }
    return false;
  }
  return reach(root, 0);
}
