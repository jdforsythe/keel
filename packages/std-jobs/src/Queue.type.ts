import type { Ctx } from "@keel/ctx";
import type { Id, KeelError, Result } from "@keel/schema";
import type { EnqueueOptions } from "./EnqueueOptions.ts";
import type { InputOf } from "./InputOf.ts";
import type { JobTable } from "./JobTable.ts";

/**
 * A module's job queue (std.jobs): a runner (k.topology `run(ctx, signal)`) and `enqueue`, typed by its table. `enqueue`
 * fails with `keel.fields` when `input` does not parse.
 */
export type Queue<T extends JobTable> = {
  readonly table: T;
  enqueue<K extends keyof T & string>(
    ctx: Ctx,
    id: K,
    input: InputOf<T[K]>,
    opts?: EnqueueOptions,
  ): Promise<Result<Id<"Job">, KeelError<string, unknown>>>;
  run(ctx: Ctx, signal: AbortSignal): Promise<void>;
};
