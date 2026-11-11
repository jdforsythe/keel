import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Schema } from "@keel/schema";
import type { Job } from "./Job.type.ts";

/**
 * Declare a job (std.jobs) in its own `*.server.ts` file: `attempts` defaults to 3 and `timeoutMs` to 60,000. `fn` must
 * be idempotent: a job runs at least once.
 */
export function job<I>(
  opts: { readonly input: Schema<I, boolean>; readonly attempts?: number; readonly timeoutMs?: number },
  fn: (input: I, ctx: Ctx, signal: AbortSignal) => Promise<Result<null, KeelError<string, unknown>>>,
): Job<I> {
  return { input: opts.input, attempts: opts.attempts ?? 3, timeoutMs: opts.timeoutMs ?? 60_000, fn };
}
