import type { Ctx } from "@keel/ctx";
import { restock } from "./restock.server.ts";

/** The store of the weekly runs and its transactions, for an action, a loader or a job that starts or reads a run. */
export const restockStores = (ctx: Ctx) => ({ restock: restock.stores(ctx) });
