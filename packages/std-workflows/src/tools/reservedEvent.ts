import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { cut } from "./internal/cut.ts";
import { lineCol } from "./internal/lineCol.ts";
import { propOf } from "./internal/propOf.ts";
import { readyFlows } from "./internal/readyFlows.ts";

/**
 * E2355 (std.workflows, k.check registry): a workflow's chart has an event named `start`, `attempt` or `forget`, a
 * name the workflow's own transactions take. Reported at the `chart` property of the `workflow` call. No fix;
 * `workflow` throws it too.
 */
export const reservedEvent: RuleDef = defineRule({
  code: "E2355",
  see: "std.workflows",
  message: (f) => `chart event '${cut(f.data?.event)}' takes the name of a workflow transaction`,
  explain:
    "A workflow's transactions are named start, attempt and forget, so its chart's events cannot be. " +
    "Fix: rename the event, start -> begin.",
  check: (input): Finding[] => {
    const out: Finding[] = [];
    for (const { flow, shape, source } of readyFlows(input))
      for (const event of shape.events ?? [])
        if (event === "start" || event === "attempt" || event === "forget")
          out.push({ path: flow.path, ...lineCol(source, propOf(flow.opts, "chart")?.start ?? 0), data: { event } });
    return out;
  },
});
