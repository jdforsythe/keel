import type { RuleInput } from "@keel/check";
import type { Ast } from "./Ast.ts";
import type { Ready } from "./Ready.ts";
import { chartShape } from "./chartShape.ts";
import { flowsIn } from "./flowsIn.ts";

const seen = new WeakMap<object, Map<string, Ast>>();

/**
 * The flows of the project whose workflow file and chart file have both been checked, the later of them being
 * `file`: so each flow is read once per run, whichever file comes first, through the ASTs `keel check` hands rules.
 */
export function readyFlows({ file, ast, project }: RuleInput): Ready[] {
  const files = seen.get(project) ?? new Map<string, Ast>();
  seen.set(project, files.set(file.path, ast));
  const out: Ready[] = [];
  for (const [path, a] of files)
    for (const flow of flowsIn(path, a)) {
      const c = files.get(flow.chart.path);
      if ((path !== file.path && flow.chart.path !== file.path) || c === undefined) continue;
      const shape = chartShape(c, flow.chart);
      const source = project.find((f) => f.path === path)?.source;
      if (shape !== undefined && source !== undefined) out.push({ flow, shape, source });
    }
  return out;
}
