import { type Schema, defect } from "@keel/schema";
import type { Job } from "@keel/std-jobs";
import type { StateSpec } from "@keel/std-statecharts";
import { asEvents } from "../unsafe/asEvents.ts";
import { looseChart } from "../unsafe/looseChart.ts";
import { stateNames } from "../unsafe/stateNames.ts";
import type { StepSpec } from "./StepSpec.ts";
import type { WaitSpec } from "./WaitSpec.ts";
import type { Workflow } from "./Workflow.type.ts";
import type { WorkflowSpec } from "./WorkflowSpec.ts";
import type { FlowInput } from "./internal/FlowInput.schema.ts";
import type { Model } from "./internal/Model.ts";
import { compileStores } from "./internal/compileStores.server.ts";
import { entryOf } from "./internal/entryOf.ts";
import { forgetJob } from "./internal/forgetJob.server.ts";
import { planKey } from "./internal/planKey.ts";
import { scanOf } from "./internal/scanOf.server.ts";
import { stepJob } from "./internal/stepJob.server.ts";
import { wakeJob } from "./internal/wakeJob.server.ts";

/**
 * Declare a workflow (std.workflows) in a `*.server.ts` file: the chart run per instance in the one store `id`, its
 * step and wait states, and their std.jobs jobs `<id>.<state>`, `<id>.wake` and `<id>.forget`. Throws E2352 for a step
 * or wait naming no state or a final state, or whose `done`, `failed` or wait event is not in that state's `on`, and
 * E2355 for a chart event named `start`, `attempt` or `forget`, the names of the workflow's own transactions.
 */
export function workflow<
  D,
  const Ev extends Readonly<Record<string, Schema<unknown>>>,
  S extends string,
  G extends string,
  A extends string,
>(id: string, spec: WorkflowSpec<D, Ev, S, G, A>): Workflow<D, Ev, S> {
  const { chart } = spec;
  const states: Readonly<Record<string, StateSpec<string, string, string, string> | undefined>> = chart.states;
  const names = stateNames<S>(chart.states);
  const [first, ...rest] = names;
  const finals = new Set<string>(names.filter((n) => states[n]?.final === true));
  const own = (part: string, state: string, events: readonly string[]): void => {
    const on = states[state]?.on;
    for (const e of events)
      if (on === undefined || finals.has(state) || !Object.hasOwn(on, e))
        defect("a workflow step or wait needs a non-final state whose on has the event", {
          code: "E2352",
          data: { workflow: id, part, state, event: e },
        });
  };
  const steps = new Map<string, StepSpec<D, Readonly<Record<string, Schema<unknown>>>>>();
  const waits = new Map<string, WaitSpec<string>>();
  const stepTable: Readonly<Record<string, StepSpec<D, Readonly<Record<string, Schema<unknown>>>> | undefined>> =
    spec.steps ?? {};
  const waitTable: Readonly<Record<string, WaitSpec<string> | undefined>> = spec.waits ?? {};
  for (const [state, step] of Object.entries(stepTable))
    if (step !== undefined) {
      own("step", state, [step.done, step.failed]);
      steps.set(state, step);
    }
  for (const [state, wait] of Object.entries(waitTable))
    if (wait !== undefined) {
      own("wait", state, [wait.event]);
      waits.set(state, wait);
    }
  if (first === undefined) defect("the workflow chart has no states", { code: "E2352", data: { workflow: id } });
  for (const e of Object.keys(chart.events))
    if (e === "start" || e === "attempt" || e === "forget")
      defect("a chart event takes the name of a workflow transaction; rename it", {
        code: "E2355",
        data: { workflow: id, event: e },
      });
  const events = new Map<string, Schema<unknown>>();
  for (const [e, t] of Object.entries(chart.events)) events.set(e, t.schema);
  const open = compileStores(
    id,
    [first, ...rest],
    chart.data,
    chart.initial,
    events,
    (() => {
      const c = looseChart<D>(chart);
      return entryOf<D>(c.next, c.taken);
    })(),
    finals,
    spec.limit ?? 1000,
  );
  const m: Model<S, D> = {
    id,
    steps,
    waits,
    finals,
    keepMs: spec.keepMs ?? 86_400_000,
    attempts: spec.attempts ?? 3,
    timeoutMs: spec.timeoutMs ?? 60_000,
    open,
  };
  const jobs: Record<string, Job<FlowInput>> = { [`${id}.wake`]: wakeJob(m), [`${id}.forget`]: forgetJob(m) };
  for (const [state, step] of steps) jobs[`${id}.${state}`] = stepJob(m, state, step);
  return {
    id,
    stores: (_ctx) => {
      const l = open();
      return { ...l, events: asEvents(l.events) };
    },
    jobs,
    [planKey]: scanOf(m),
  };
}
