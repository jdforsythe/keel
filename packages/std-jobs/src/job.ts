import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, type Schema, defect } from "@keel/schema";
import type { Job } from "./Job.type.ts";

/**
 * Declare a job (std.jobs) in its own `*.server.ts` file: `attempts` defaults to 3 and `timeoutMs` to 60,000. `fn` must
 * be idempotent: a job runs at least once. Throws E2505 for an `attempts` or `timeoutMs` that is not a positive integer.
 */
export function job<I>(
  opts: { readonly input: Schema<I, boolean>; readonly attempts?: number; readonly timeoutMs?: number },
  fn: (input: I, ctx: Ctx, signal: AbortSignal) => Promise<Result<null, KeelError<string, unknown>>>,
): Job<I> {
  const attempts = opts.attempts ?? 3;
  const timeoutMs = opts.timeoutMs ?? 60_000;
  for (const [name, n] of [
    ["attempts", attempts],
    ["timeoutMs", timeoutMs],
  ] as const)
    if (!Number.isSafeInteger(n) || n <= 0) defect(`job ${name} ${String(n)} is not a positive integer`, "E2505");
  return { input: opts.input, attempts, timeoutMs, fn };
}
