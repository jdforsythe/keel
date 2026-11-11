import type { Ctx } from "@keel/ctx";

/**
 * A module's background work (k.topology Runners), listed in `modules/<id>/runners.server.ts` and built by stdlib
 * packages. `createApp({ runners })` calls `run` once after startup with the app's `ctx`; `signal` aborts on `close()`.
 */
export type Runner = {
  run(ctx: Ctx, signal: AbortSignal): Promise<void>;
};
