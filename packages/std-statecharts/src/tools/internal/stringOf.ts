import type { Node } from "./Node.ts";

/** The value of a string literal node, else undefined. */
export function stringOf(x: Node | undefined): string | undefined {
  return x?.type === "Literal" && typeof x.value === "string" ? x.value : undefined;
}
