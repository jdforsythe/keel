import type { Schema } from "@keel/schema";

type Node = Schema<unknown>["node"];

/** `n` without its wrappers, a union's or `anyOf`'s branches spread: every shape a value of `n` may take. */
function shapes(n: Node): Node[] {
  switch (n.kind) {
    case "nullable":
    case "optional":
    case "secret":
      return shapes(n.inner);
    case "format":
      return shapes(n.base);
    case "union":
      return n.variants.flatMap(shapes);
    case "anyOf":
      return n.members.flatMap(shapes);
    default:
      return [n];
  }
}

/**
 * An issue `path` under `node` as a log may print it (k.privacy Server log): an object's field name and an array's
 * index as they are, since the schema or the value's length names them; a record's key, a `json` value's key, and any
 * segment a branch of a union could read as one, as `*`, since a key is data. Segments are joined by `.`.
 */
export function shownPath(node: Node, path: readonly (string | number)[]): string {
  let at = shapes(node);
  const out: (string | number)[] = [];
  for (const seg of path) {
    let named = at.length > 0;
    const next: Node[] = [];
    for (const n of at) {
      if (n.kind === "object" && typeof seg === "string" && Object.hasOwn(n.fields, seg)) {
        const f = n.fields[seg];
        if (f !== undefined) next.push(...shapes(f));
      } else if (n.kind === "array" && typeof seg === "number") next.push(...shapes(n.item));
      else {
        named = false;
        if (n.kind === "record") next.push(...shapes(n.value));
        if (n.kind === "json") next.push(n);
      }
    }
    out.push(named ? seg : "*");
    at = next;
  }
  return out.join(".");
}
