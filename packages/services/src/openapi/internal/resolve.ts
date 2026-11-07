import type { Gen } from "./Gen.ts";
import type { Path } from "./Path.ts";
import { isRecord } from "./isRecord.ts";

/**
 * Follow `$ref` (a local JSON pointer `#/...`) until a node without one. `refs` holds the refs already followed
 * on this branch; a ref seen again is a cycle. Returns the node and the refs, or undefined after recording an issue.
 */
export function resolve(
  g: Gen,
  node: unknown,
  at: Path,
  refs: ReadonlySet<string>,
): { readonly node: unknown; readonly refs: ReadonlySet<string> } | undefined {
  let cur = node;
  let seen = refs;
  while (isRecord(cur) && typeof cur.$ref === "string") {
    const ref = cur.$ref;
    if (seen.has(ref) || !ref.startsWith("#/")) {
      g.issues.push({ path: [...at, "$ref"], rule: "type" });
      return undefined;
    }
    seen = new Set([...seen, ref]);
    let target: unknown = g.doc;
    for (const raw of ref.slice(2).split("/")) {
      const key = raw.replaceAll("~1", "/").replaceAll("~0", "~");
      target = isRecord(target) && Object.hasOwn(target, key) ? target[key] : undefined;
    }
    if (target === undefined) {
      g.issues.push({ path: [...at, "$ref"], rule: "required" });
      return undefined;
    }
    cur = target;
  }
  return { node: cur, refs: seen };
}
