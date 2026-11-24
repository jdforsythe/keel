import { err, ok, s } from "@keel/schema";
import { commitStores } from "@keel/server";
import { job } from "@keel/std-jobs";
import { instantOf } from "@keel/std-temporal";
import { restockStores } from "./restockStores.server.ts";
import { startRun } from "./startRun.ts";

/** The job the weekly schedule enqueues: starts a run, saved in one commit of the workflow store. */
export const startRestock = job({ input: s.object({}) }, async (_input, ctx) => {
  const at = instantOf(ctx.clock.now());
  if (!at.ok) return err(at.error);
  const started = await commitStores(ctx, restockStores, (stores) =>
    startRun(stores, { id: ctx.random.id("Flow"), by: "schedule", at: at.value }),
  );
  return started.ok ? ok(null) : err(started.error);
});
