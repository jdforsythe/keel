import type { JsonMember } from "./JsonMember.ts";
import type { JsonNode } from "./JsonNode.ts";

/** The first member of object `node` named `key`, or undefined (also when `node` is not an object). */
export function memberOf(node: JsonNode | undefined, key: string): JsonMember | undefined {
  return node?.kind === "object" ? node.members.find((m) => m.key === key) : undefined;
}
