import type { RouteDef } from "../types/RouteDef.ts";
import type { Prefix } from "./Prefix.ts";
import { fieldsOf } from "./fieldsOf.ts";

/** The `pathDefault` enum declared by `def`'s params field `name`, as a `Prefix`, or null when it declares none. */
export function paramEnum(def: RouteDef, name: string): Prefix | null {
  if (def.params === undefined) return null;
  const node = fieldsOf(def.params.node).find(([k]) => k === name)?.[1];
  return node?.kind === "enum" && node.pathDefault !== undefined
    ? { name, values: node.values, d: node.pathDefault }
    : null;
}
