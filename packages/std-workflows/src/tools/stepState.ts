import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { lineCol, propOf } from "@keel/std-jobs/tools/internal";
import { cut } from "./internal/cut.ts";
import { entries } from "./internal/entries.ts";
import { readyFlows } from "./internal/readyFlows.ts";
import { str } from "./internal/str.ts";

/**
 * E2352 (std.workflows, k.check registry): a step or wait naming no state of its chart or a final one, or whose
 * `done`, `failed` or wait `event` is not in that state's `on`. No fix; `workflow` throws it too.
 */
export const stepState: RuleDef = defineRule({
  code: "E2352",
  see: "std.workflows",
  message: (f) => `${f.data?.kind} '${cut(f.data?.name)}' ${f.data?.why}`,
  explain:
    "A step or wait names a non-final state whose on holds its events. " +
    "Fix: steps: { purging: { done: 'purged' } } with purging: { on: { purged: ... } }.",
  check: (input): Finding[] => {
    const out: Finding[] = [];
    for (const { flow, shape, source } of readyFlows(input))
      for (const kind of ["step", "wait"])
        for (const e of entries(propOf(flow.opts, `${kind}s`))) {
          const s = shape.states.find((st) => st.name === e.name);
          const evs = kind === "step" ? ["done", "failed"] : ["event"];
          const event = evs.map((k) => str(propOf(e.value, k))).find((v) => !s?.on.some((o) => o.event.name === v));
          const why =
            s === undefined
              ? "names no state"
              : s.final
                ? "names a final state"
                : event !== undefined && `event '${cut(event)}' is not in its state's on`;
          if (!why) continue;
          const data = { kind, name: e.name, why };
          out.push({ path: flow.path, ...lineCol(source, e.at), data });
        }
    return out;
  },
});
