import type { Ctx } from "@keel/ctx";
import type { Infer, KeelError, Result, Schema } from "@keel/schema";
import type { StepEnv } from "./StepEnv.ts";

/**
 * A step of a workflow (std.workflows), keyed by its state, over the chart's events `Ev`: `run` gets the instance's
 * `data`; its `ok` value is the payload of the chart event `done`, typed by that event's schema, and an `err` on the
 * last of `attempts` runs sends `failed` with `{ code }`. One member per event `done` may name, so `done` picks the
 * payload `run` answers.
 */
export type StepSpec<
  D,
  Ev extends Readonly<Record<string, Schema<unknown>>>,
  E extends keyof Ev & string = keyof Ev & string,
> = {
  readonly [K in E]: {
    run(data: D, ctx: Ctx, env: StepEnv): Promise<Result<Infer<Ev[K]>, KeelError<string, unknown>>>;
    readonly done: K;
    readonly failed: E;
    readonly attempts?: number;
    readonly timeoutMs?: number;
  };
}[E];
