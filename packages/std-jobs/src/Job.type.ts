import type { Ctx } from "@keel/ctx";
import type { KeelError, Result, Schema } from "@keel/schema";

/**
 * A job (std.jobs): the schema its stored input parses with, how many runs it gets, how long one run may take, and
 * `fn`, which gets the parsed input, the app's `ctx` and a `signal` aborted on timeout or when the runner stops.
 */
export type Job<I> = {
  readonly input: Schema<I, boolean>;
  readonly attempts: number;
  readonly timeoutMs: number;
  fn(input: I, ctx: Ctx, signal: AbortSignal): Promise<Result<null, KeelError<string, unknown>>>;
};
