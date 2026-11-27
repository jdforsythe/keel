import type { Ctx } from "@keel/ctx";
import { type KeelError, type Result, type Schema, err, ok } from "@keel/schema";
import { commitStores } from "@keel/server";
import { type Job, job } from "@keel/std-jobs";
import { tx } from "@keel/store";
import type { StepSpec } from "../StepSpec.ts";
import { FlowInput } from "./FlowInput.schema.ts";
import type { LooseStores } from "./LooseStores.ts";
import type { Model } from "./Model.ts";
import { rowOf } from "./rowOf.ts";

/** Commits `failed` `{ code }`; its refusal is an `err` with the refusal's code alone, so the commit saves nothing. */
const failed = <S extends string, D>(
  S: LooseStores<S, D>,
  event: string,
  id: string,
  code: string,
): Result<undefined, KeelError<string, unknown>> => {
  const t = S.events[event];
  const r = t === undefined ? ok(null) : tx(t, { id, payload: { code } });
  return r.ok ? ok(undefined) : err({ code: r.error.code, message: "the failed event refused its code", data: {} });
};

/**
 * The job of step `state` (std.workflows Run), with std.jobs `attempts` one more than the step's: through
 * `commitStores` it stops if the instance moved, commits `attempt` (past `attempts`: `failed` `workflows.attempts`),
 * calls `run` with `signal` and `key` and commits `done` with its `ok` value; an `err` counts a std.jobs attempt, or on
 * the last one commits `failed` with its code. A `done` payload the event refuses commits `failed` with that code. A
 * refused `failed` is an `err` that counts a std.jobs attempt: the next run is past `attempts` and commits `failed`
 * `workflows.attempts`; if that is refused too, the job ends in std.jobs `failed` with the refusal's code.
 */
export function stepJob<S extends string, D>(
  m: Model<S, D>,
  state: string,
  step: StepSpec<D, Readonly<Record<string, Schema<unknown>>>>,
): Job<FlowInput> {
  const max = step.attempts ?? m.attempts;
  const here = (s: string): boolean => s === state;
  return job(
    { input: FlowInput, attempts: max + 1, timeoutMs: step.timeoutMs ?? m.timeoutMs },
    async (input, ctx: Ctx, signal): Promise<Result<null, KeelError<string, unknown>>> => {
      const first = await commitStores(ctx, m.open, (S) => {
        const r = rowOf(S, input, here);
        if (r === undefined) return ok(undefined);
        if (r.attempt >= max) return failed(S, step.failed, input.id, "workflows.attempts");
        const counted = tx(S.attempt, input);
        if (!counted.ok) return counted;
        return ok({ data: r.data, last: r.attempt + 1 >= max });
      });
      if (!first.ok) return first;
      if (first.value === undefined) return ok(null);
      const out = await step.run(first.value.data, ctx, { signal, key: `${input.id}:${m.id}:${input.entered}` });
      if (signal.aborted) return ok(null);
      if (!out.ok && !first.value.last) return err(out.error);
      const second = await commitStores(ctx, m.open, (S) => {
        if (rowOf(S, input, here) === undefined) return ok(null);
        const t = S.events[step.done];
        const done = out.ok && t !== undefined ? tx(t, { id: input.id, payload: out.value }) : undefined;
        if (done?.ok) return ok(null);
        const f = failed(S, step.failed, input.id, out.ok ? (done?.error.code ?? "") : out.error.code);
        return f.ok ? ok(null) : f;
      });
      return second.ok ? ok(null) : second;
    },
  );
}
