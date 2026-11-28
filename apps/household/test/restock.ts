import type { SimCtx } from "@keel/ctx";
import { type Infer, s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
import { type Scenario, simulate } from "@keel/testing";
import type { Runs } from "../modules/shopping/Runs.schema.ts";
import { shoppingApi } from "../modules/shopping/shoppingApi.ts";
import { shoppingDb } from "../modules/shopping/shoppingDb.server.ts";

const Restock = s.object({ name: s.string(), putBack: s.boolean() });

/** The weekly runs as a member reads them, through the shopping API in process (`user` is any member id). */
export async function runsOn(ctx: SimCtx, user = "member-1"): Promise<Infer<typeof Runs>> {
  const r = await shoppingApi.runs({ user }, ctx);
  if (!r.ok) throw new Error(`the runs did not answer: ${r.error.code}`);
  return r.value;
}

/** The list as `name × qty` (bought ones marked), in the order the items were first added. */
export async function listOn(ctx: SimCtx, user = "member-1"): Promise<string[]> {
  const r = await shoppingApi.items({ user }, ctx);
  if (!r.ok) throw new Error(`the list did not answer: ${r.error.code}`);
  return r.value.items.map((i) => `${i.name} × ${i.qty}${i.bought ? " bought" : ""}`);
}

/** Every `restocks` row: one per staple step that committed. */
export async function restocksOn(ctx: SimCtx) {
  const r = await shoppingDb(ctx).query(sql(Restock)`select name, put_back as "putBack" from restocks order by name`);
  if (!r.ok) throw new Error(`restocks did not answer: ${r.error.code}`);
  return r.value;
}

/**
 * Reads `read`, again after each failure (a read through a refused storage call under a schedule), at most 40 times;
 * the run's clock moves 500 ms between tries. Throws when every try failed.
 */
export async function steadily<T>(ctx: SimCtx, read: () => Promise<T>): Promise<T> {
  for (let n = 0; n < 40; n++) {
    try {
      return await read();
    } catch {
      await ctx.clock.after(500);
    }
  }
  throw new Error("the server did not answer in 40 tries");
}

/** `scenario` under `simulate` on one `SimRun` of `seed` with an empty schedule: the run's clock moves while it waits. */
export const alone = (seed: number, scenario: Scenario, horizon?: number) =>
  simulate(scenario, {
    replay: { seed, schedule: { net: [], storage: [], offline: [], plans: {} } },
    ...(horizon === undefined ? {} : { horizon }),
  });

/** True once the latest run has ended, done or failed. */
export const ended = (runs: Infer<typeof Runs>) => runs.last !== null && runs.last.state !== "running";
