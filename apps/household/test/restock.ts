import type { SimCtx } from "@keel/ctx";
import { type Infer, s } from "@keel/schema";
import { sql } from "@keel/std-postgres";
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

/** Resolves once the event loop has run its pending I/O callbacks (the server's PGlite work), with no timer. */
const yieldToIo = () => new Promise<void>((resolve) => setImmediate(resolve));

/**
 * Awaits `work` while the server moves: under a `simulate` schedule a storage call or a database statement may wait
 * on the clock, so while `work` is pending, every 20 turns of the event loop move the clock 100 ms. Answers `null`
 * when `work` fails, as a read through a refused storage call does under a schedule.
 */
async function moving<T>(ctx: SimCtx, work: Promise<T>): Promise<T | null> {
  let pending = true;
  const settled = work.then(
    (v) => {
      pending = false;
      return v;
    },
    () => {
      pending = false;
      return null;
    },
  );
  for (let n = 1; n <= 40_000 && pending; n++) {
    await yieldToIo();
    if (n % 20 === 0) ctx.clock.advance(100);
  }
  return settled;
}

/**
 * Reads `read` while the server moves, again after each failure, at most 40 times; the clock moves 500 ms between
 * tries. Throws when every try failed.
 */
export async function steadily<T>(ctx: SimCtx, read: () => Promise<T>): Promise<T> {
  for (let n = 0; n < 40; n++) {
    const v = await moving(ctx, read());
    if (v !== null) return v;
    ctx.clock.advance(500);
  }
  throw new Error("the server did not answer in 40 tries");
}

/**
 * One turn of the server: a read of the list's database, which waits behind any step's transaction there, then a read
 * of the runs; then the clock moves 500 ms. Answers the runs as read, `null` when the read failed.
 */
export async function turn(ctx: SimCtx): Promise<Infer<typeof Runs> | null> {
  const runs = await moving(
    ctx,
    restocksOn(ctx).then(() => runsOn(ctx)),
  );
  ctx.clock.advance(500);
  return runs;
}

/** Moves the server along, a turn at a time, until `done` holds or `turns` run out. Answers the turns taken. */
export async function drive(ctx: SimCtx, done: (runs: Infer<typeof Runs>) => boolean, turns = 80): Promise<number> {
  for (let n = 0; n < turns; n++) {
    const runs = await turn(ctx);
    if (runs !== null && done(runs)) return n;
  }
  return turns;
}

/** True once the latest run has ended, done or failed. */
export const ended = (runs: Infer<typeof Runs>) => runs.last !== null && runs.last.state !== "running";
