import type { Ctx } from "@keel/ctx";

/** One loader of a route chain that names `stores` (k.server Server state): its route id, the factory and its name. */
export type ChainLevel = {
  readonly route: string;
  readonly name: string;
  readonly factory: (ctx: Ctx) => unknown;
};
