import type { Ctx } from "@keel/ctx";
import type { KeelError, Result } from "@keel/schema";
import type { StepEnv } from "./StepEnv.ts";

/**
 * A step of a workflow (std.workflows), keyed by its state: `run` gets the instance's `data`; its `ok` value is the
 * payload of the chart event `done`, and an `err` on the last of `attempts` runs sends `failed` with `{ code }`.
 */
export type StepSpec<D, E extends string> = {
  run(data: D, ctx: Ctx, env: StepEnv): Promise<Result<unknown, KeelError<string, unknown>>>;
  readonly done: E;
  readonly failed: E;
  readonly attempts?: number;
  readonly timeoutMs?: number;
};
