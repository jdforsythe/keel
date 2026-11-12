import { stdConfig } from "@keel/compiler/std/stdConfig";
import type { Ctx } from "@keel/ctx";
import type { JobTable } from "../JobTable.ts";
import { JobsConfig } from "../JobsConfig.ts";
import { chanOf } from "./chanOf.ts";
import { finish } from "./finish.ts";
import { idle } from "./idle.ts";
import { runOnce } from "./runOnce.ts";
import { transact } from "./transact.ts";
import { wake } from "./wake.ts";

const noop = (): void => undefined;

/**
 * The queue's runner (std.jobs Run, Restart): leases left by a stopped process are released (their run already
 * counted), then due jobs start in `at`, then `id` order, at most the module's `concurrency` at once, each leased (and
 * its run counted) before `fn`. Between jobs it waits on `ctx.clock` for the next `at`, an enqueue or a finished run.
 * When `signal` aborts no job starts; running ones see their `signal` abort and stay leased.
 */
export async function runQueue(ctx: Ctx, signal: AbortSignal, module: string, table: JobTable): Promise<void> {
  const max = stdConfig(ctx, "@keel/std-jobs", JobsConfig)[module]?.concurrency ?? 1;
  const c = chanOf(ctx.storage, `std.jobs.${module}`);
  const live = new Set<AbortController>();
  signal.addEventListener("abort", () => {
    for (const a of live) a.abort(signal.reason);
  });
  await transact(ctx, module, (st) => {
    for (const x of st.q) x.l = false;
  });
  while (!signal.aborted) {
    const v = c.v;
    const now = ctx.clock.now();
    const { due, next } = await transact(ctx, module, (st) => {
      const due = st.q
        .filter((x) => !x.l && x.at <= now)
        .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
        .slice(0, max - live.size);
      for (const x of due) {
        x.l = true;
        x.n++;
      }
      return {
        due: due.map((x) => ({ ...x })),
        next: st.q.reduce((m, x) => (x.l ? m : Math.min(m, x.at)), Number.POSITIVE_INFINITY),
      };
    });
    if (signal.aborted) return;
    for (const x of due) {
      const a = new AbortController();
      const j = table[x.job];
      live.add(a);
      runOnce(ctx, j, x.input, a)
        .then((code) => {
          live.delete(a);
          if (!signal.aborted) return finish(ctx, module, x.id, code, j?.attempts ?? 1).then(() => wake(c));
        })
        .catch(noop);
    }
    await idle(ctx, c, v, live.size >= max ? Number.POSITIVE_INFINITY : next - now, signal);
  }
}
