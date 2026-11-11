import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import type { Runner } from "../types/Runner.ts";

const RESTART_MS = 1000;

/**
 * Run `runner` until it settles (k.topology Runners): a `run` that rejects before `signal` aborts is reported to
 * `failed` and runs again 1,000 ms later on `ctx.clock`. Resolves once a `run` resolves, or rejects after `signal`
 * aborted, or `signal` aborts during the wait; never rejects.
 */
export async function keepRunning(
  runner: Runner,
  ctx: Ctx,
  signal: AbortSignal,
  failed: (message: string) => void,
): Promise<void> {
  while (!signal.aborted) {
    const ran = await attempt(() => runner.run(ctx, signal));
    if (ran.ok || signal.aborted) return;
    failed(ran.error.message);
    const waited = await attempt(() => ctx.clock.after(RESTART_MS, signal));
    if (!waited.ok) return;
  }
}
