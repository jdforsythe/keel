import type { JsonNode } from "./JsonNode.ts";

/** One token of a design tokens file: its path of group and token names, its `$type` (its own or a group's above), its `$value` and the offset of that key. */
export type DesignToken = {
  readonly path: readonly string[];
  readonly type: string | undefined;
  readonly value: JsonNode;
  readonly valueAt: number;
};
