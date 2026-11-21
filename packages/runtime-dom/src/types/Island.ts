import type { Ctx } from "@keel/ctx";

/** A compiled island component, called with its decoded props and the island root's `ctx`. (Bivariant so typed props are accepted.) */
export type Island = {
  bivariance(props: Readonly<Record<string, unknown>>, ctx: Ctx): Node;
}["bivariance"];
