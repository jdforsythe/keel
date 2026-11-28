import type { JsonNode } from "./JsonNode.ts";

/** The path `{a.b}` names when `node` is a string of exactly that form, else undefined. */
export function aliasPath(node: JsonNode): string[] | undefined {
  if (node.kind !== "string") return undefined;
  const m = /^\{([^{}]+)\}$/.exec(node.value);
  return m?.[1] === undefined ? undefined : m[1].split(".");
}
