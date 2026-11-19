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
 * The queue's runner (std.jobs Run, Restart): due jobs whose lease is free or past its end start in `at`, then `id`
 * order, at most the module's `concurrency` at once, each leased until `timeoutMs` plus 1,000 ms (its run counted) in
 * the same commit, so runners sharing a storage never lease one job twice. Between jobs it waits on `ctx.clock` for
 * the next `at` or lease end, an enqueue or a finished run. When `signal` aborts no job starts, running ones see their
 * `signal` abort, and their leases are freed before `run` resolves.
 */
export async function runQueue(ctx: Ctx, signal: AbortSignal, module: string, table: JobTable): Promise<void> {
  const max = stdConfig(ctx, "@keel/std-jobs", JobsConfig)[module]?.concurrency ?? 1;
  const c = chanOf(ctx.storage, `std.jobs.${module}`);
  const live = new Map<string, AbortController>();
  signal.addEventListener("abort", () => {
    for (const a of live.values()) a.abort(signal.reason);
  });
  while (!signal.aborted) {
    const v = c.v;
    const now = ctx.clock.now();
    const { due, next } = await transact(ctx, module, (st) => {
      const due = st.q
        .filter((x) => x.l <= now && x.at <= now)
        .sort((a, b) => a.at - b.at || (a.id < b.id ? -1 : 1))
        .slice(0, max - live.size);
      for (const x of due) {
        x.l = now + (table[x.job]?.timeoutMs ?? 0) + 1000;
        x.n++;
      }
      return {
        due: due.map((x) => ({ ...x })),
        next: st.q.reduce((m, x) => Math.min(m, Math.max(x.at, x.l)), Number.POSITIVE_INFINITY),
      };
    });
    for (const x of due) live.set(x.id, new AbortController());
    for (const x of due) {
      const a = live.get(x.id);
      const j = table[x.job];
      if (a === undefined || signal.aborted) break;
      runOnce(ctx, j, x.input, a)
        .then((code) => {
          if (signal.aborted) return;
          live.delete(x.id);
          return finish(ctx, module, x.id, code, j?.attempts ?? 1).then(() => wake(c));
        })
        .catch(noop);
    }
    await idle(ctx, c, v, live.size >= max ? Number.POSITIVE_INFINITY : next - now, signal);
  }
  await transact(ctx, module, (st) => {
    for (const x of st.q) if (live.has(x.id)) x.l = 0;
  });
}
