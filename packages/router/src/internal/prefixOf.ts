import type { RouteDef } from "../types/RouteDef.ts";
import type { Prefix } from "./Prefix.ts";
import type { Segment } from "./Segment.ts";
import { paramEnum } from "./paramEnum.ts";

/** The prefix param of a route (k.prefix): its first segment `:p` when params field `p` has a `pathDefault`. */
export function prefixOf(def: RouteDef, segments: readonly Segment[] | null): Prefix | null {
  const first = segments?.[0];
  return first?.kind === "param" ? paramEnum(def, first.name) : null;
}
