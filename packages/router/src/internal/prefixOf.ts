import type { ObjectSchema } from "@keel/schema";
import type { Prefix } from "./Prefix.ts";
import type { Segment } from "./Segment.ts";
import { paramEnum } from "./paramEnum.ts";

/** The prefix param of an entry (k.prefix): its first segment `:p` when params field `p` has a `pathDefault`. */
export function prefixOf(
  e: { readonly params?: ObjectSchema<unknown> | undefined },
  segments: readonly Segment[] | null,
): Prefix | null {
  const first = segments?.[0];
  return first?.kind === "param" ? paramEnum(e, first.name) : null;
}
