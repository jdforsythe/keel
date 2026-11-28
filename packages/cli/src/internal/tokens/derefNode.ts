import type { JsonNode } from "./JsonNode.ts";
import type { Reach } from "./Reach.ts";
import { aliasPath } from "./aliasPath.ts";
import { findToken } from "./findToken.ts";
import { resolveAlias } from "./resolveAlias.ts";

/** `node`, or when it is an alias the `$value` it stands for; undefined when the alias does not resolve. */
export function derefNode(reach: Reach, node: JsonNode): JsonNode | undefined {
  const path = aliasPath(node);
  if (path === undefined) return node;
  const target = findToken(reach.files, reach.file, path);
  if (target === undefined) return undefined;
  const r = resolveAlias(reach.files, target);
  return "error" in r ? undefined : r.token.value;
}
