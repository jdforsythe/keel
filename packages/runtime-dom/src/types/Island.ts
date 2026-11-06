import type { Ctx } from "@keel/ctx";
import type { Slots } from "./Slots.ts";

/** A compiled island component, called with its decoded props and the island root's `ctx`. (Bivariant so typed props are accepted.) */
export type Island = {
  bivariance(props: Readonly<Record<string, unknown>>, slots?: Slots, ctx?: Ctx): Node;
}["bivariance"];
