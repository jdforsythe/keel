import { type Finding, type RuleDef, defineRule } from "@keel/check";
import { lineCol, propOf } from "@keel/std-jobs/tools";
import { cut } from "./internal/cut.ts";
import { entries } from "./internal/entries.ts";
import { readyFlows } from "./internal/readyFlows.ts";
import { str } from "./internal/str.ts";
import { targets } from "./internal/targets.ts";

/**
 * W2353 (std.workflows, k.check registry): a step whose `failed` event leads to a final state while another step's
 * `done` lies on a path to it, so that step's effect is never undone. Names both steps. No fix.
 */
export const undoneStep: RuleDef = defineRule({
  code: "W2353",
  see: "std.workflows",
  message: (f) => {
    const [a, t, b] = [f.data?.step, f.data?.final, f.data?.undone].map((v) => cut(v, 16));
    return `'${a}' fails to final '${t}', so '${b}' is never undone`;
  },
  explain:
    "A failed step that ends the workflow keeps earlier steps' effects. " +
    "Fix: declined: 'releasing', a step undoing reserving.",
  check: (input): Finding[] => {
    const out: Finding[] = [];
    for (const { flow, shape, source } of readyFlows(input)) {
      const steps = entries(propOf(flow.opts, "steps")).map((e) => ({
        ...e,
        done: str(propOf(e.value, "done")),
        failed: str(propOf(e.value, "failed")),
      }));
      const reaches = (from: string[], to: string): boolean => {
        const seen = new Set<string>();
        for (let n = from.pop(); n !== undefined; n = from.pop()) {
          if (seen.has(n)) continue;
          seen.add(n);
          for (const o of shape.states.find((s) => s.name === n)?.on ?? [])
            from.push(...targets(shape, n, o.event.name));
        }
        return seen.has(to);
      };
      for (const a of steps) {
        const final = targets(shape, a.name, a.failed).find((t) => shape.states.some((s) => s.name === t && s.final));
        const b = steps.find((b) => b !== a && reaches(targets(shape, b.name, b.done), a.name));
        if (final !== undefined && b !== undefined)
          out.push({ path: flow.path, ...lineCol(source, a.at), data: { step: a.name, final, undone: b.name } });
      }
    }
    return out;
  },
});
