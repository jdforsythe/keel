import { action } from "@keel/router";
import { err, ok } from "@keel/schema";
import { instantOf } from "@keel/std-temporal";
import { restockStores } from "./restockStores.server.ts";
import { runsOf } from "./runsOf.ts";
import { shopping } from "./shopping.contract.ts";
import { startRun } from "./startRun.ts";

/** Run now: starts a weekly run unless one is going, and answers the runs as saved. */
export const postRun = action(shopping, "shopping.run", { stores: restockStores }, async (_body, { stores }, ctx) => {
  const at = instantOf(ctx.clock.now());
  if (!at.ok) return err(at.error);
  const started = startRun(stores, { id: ctx.random.id("Flow"), by: "member", at: at.value });
  if (!started.ok) return err(started.error);
  return ok(runsOf(stores.restock.store.get("instances")));
});
