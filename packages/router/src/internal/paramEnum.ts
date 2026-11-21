import type { ObjectSchema } from "@keel/schema";
import type { Prefix } from "./Prefix.ts";
import { fieldsOf } from "./fieldsOf.ts";

/** The `pathDefault` enum an entry's params field `name` declares, as a `Prefix`, or null when it declares none. */
export function paramEnum(e: { readonly params?: ObjectSchema<unknown> | undefined }, name: string): Prefix | null {
  if (e.params === undefined) return null;
  const node = fieldsOf(e.params.node).find(([k]) => k === name)?.[1];
  return node?.kind === "enum" && node.pathDefault !== undefined
    ? { name, values: node.values, d: node.pathDefault }
    : null;
}
