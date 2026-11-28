import type { Ctx } from "@keel/ctx";
import type { Id, KeelError, Result } from "@keel/schema";
import type { EnqueueOptions } from "@keel/std-jobs";

/** The std.jobs `queue` that `flows` enqueues into: one whose table spreads in each workflow's `jobs`. */
export type FlowQueue = {
  enqueue(
    ctx: Ctx,
    id: string,
    input: { id: string; entered: number },
    opts?: EnqueueOptions,
  ): Promise<Result<Id<"Job">, KeelError<string, unknown>>>;
};
