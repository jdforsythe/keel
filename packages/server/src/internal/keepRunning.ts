import type { Ctx } from "@keel/ctx";
import { attempt } from "@keel/schema";
import type { Runner } from "../types/Runner.ts";
import { caught } from "./caught.ts";
import { requestSecrets } from "./requestSecrets.ts";

const RESTART_MS = 1000;

/**
 * Run `runner` until it settles (k.topology Runners): each call of its `run` enters a fresh scrub scope
 * (`requestSecrets`), so each `Secret` made while it runs joins that call's set (`noteRequestSecrets`). A `run` that
 * rejects before `signal` aborts is reported to `failed` with its whole thrown text, unclipped so the scrub sees each
 * value whole, its app frames (`caught` with `read`) and its set, and
 * runs again 1,000 ms later on `ctx.clock` with a new set. Resolves once a `run` resolves, or rejects after `signal`
 * aborted, or `signal` aborts during the wait; never rejects.
 */
export async function keepRunning(
  runner: Runner,
  ctx: Ctx,
  signal: AbortSignal,
  failed: (message: string, frames: readonly string[], secrets: Set<string>) => void,
  read: (thrown: unknown) => readonly string[],
): Promise<void> {
  while (!signal.aborted) {
    const secrets = new Set<string>();
    const { result: ran, frames } = await caught(
      () => requestSecrets.run(secrets, () => runner.run(ctx, signal)),
      read,
    );
    if (ran.ok || signal.aborted) return;
    failed(ran.error.data.cause, frames, secrets);
    const waited = await attempt(() => ctx.clock.after(RESTART_MS, signal));
    if (!waited.ok) return;
  }
}
