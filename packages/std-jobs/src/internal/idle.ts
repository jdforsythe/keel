import type { Ctx } from "@keel/ctx";
import type { Chan } from "./Chan.ts";

/** Wait `ms` on `ctx.clock` (forever for `Infinity`), or until `c` wakes after version `v`, or `signal` aborts. */
export function idle(ctx: Ctx, c: Chan, v: number, ms: number, signal: AbortSignal): Promise<void> {
  if (c.v !== v || signal.aborted) return Promise.resolve();
  const a = new AbortController();
  const end = (): void => a.abort();
  c.wake.add(end);
  signal.addEventListener("abort", end, { once: true });
  return new Promise<void>((done) => {
    a.signal.addEventListener("abort", () => done(), { once: true });
    if (ms < Number.POSITIVE_INFINITY) ctx.clock.after(Math.max(0, ms), a.signal).then(end, end);
  }).finally(() => {
    c.wake.delete(end);
    signal.removeEventListener("abort", end);
  });
}
