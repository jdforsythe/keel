import type { SchemaNode as Node } from "./SchemaNode.ts";
import { codedError } from "./codedError.ts";

/** The path of the first `secret` node under `node`, in declaration order (`*` for an array item or record value). */
function secretAt(node: Node, path: readonly string[]): readonly string[] | null {
  switch (node.kind) {
    case "secret":
      return path;
    case "optional":
    case "nullable":
      return secretAt(node.inner, path);
    case "format":
      return secretAt(node.base, path);
    case "array":
      return secretAt(node.item, [...path, "*"]);
    case "record":
      return secretAt(node.value, [...path, "*"]);
    case "object":
      return first(Object.entries(node.fields), ([k, f]) => secretAt(f, [...path, k]));
    case "union":
      return first(node.variants, (v) => secretAt(v, path));
    case "anyOf":
      return first(node.members, (m) => secretAt(m, path));
    default:
      return null;
  }
}

function first<X>(xs: readonly X[], f: (x: X) => readonly string[] | null): readonly string[] | null {
  for (const x of xs) {
    const p = f(x);
    if (p !== null) return p;
  }
  return null;
}

/**
 * Throw E1113 when a `loader` or `action` `output` schema holds an `s.secret` node anywhere (k.privacy): a secret
 * encodes as `"[secret]"`, so the answer would carry the marker. Names the first such node's dotted path.
 */
export function refuseSecret(output: { readonly node: Node }): void {
  const at = secretAt(output.node, []);
  if (at !== null)
    throw codedError(
      "E1113",
      `output holds s.secret at ${at.length === 0 ? "(root)" : at.join(".")}: it would encode as "[secret]"`,
    );
}
