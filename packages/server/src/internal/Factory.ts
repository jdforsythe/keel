import type { Ctx } from "@keel/ctx";

/** A `stores` factory named by a loader or action (k.server Server state). */
export type Factory = (ctx: Ctx) => unknown;
