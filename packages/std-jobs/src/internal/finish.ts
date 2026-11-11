import type { Ctx } from "@keel/ctx";
import { backoff } from "./backoff.ts";
import { transact } from "./transact.ts";

/**
 * Store the outcome of run `n` of job `id`: `ok` (code undefined) removes it; a failure waits `backoff(n)` on
 * `ctx.clock`, or after `attempts` runs moves it to the newest 100 failures with its code and no input. A finished
 * job's key joins the last 1,000.
 */
export function finish(
  ctx: Ctx,
  module: string,
  id: string,
  code: string | undefined,
  attempts: number,
): Promise<void> {
  return transact(ctx, module, (st) => {
    const i = st.q.findIndex((x) => x.id === id);
    const x = st.q[i];
    if (x === undefined) return;
    const now = ctx.clock.now();
    if (code !== undefined && x.n < attempts) {
      x.l = false;
      x.at = now + backoff(x.n);
      return;
    }
    st.q.splice(i, 1);
    if (x.key !== undefined) st.done = [...st.done, { k: x.key, id: x.id }].slice(-1000);
    if (code !== undefined) st.failed = [...st.failed, { id: x.id, job: x.job, code, at: now }].slice(-100);
  });
}
