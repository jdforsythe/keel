import type { RuleInput, SourceFile } from "@keel/check";
import { parseSync } from "oxc-parser";
import type { Ast } from "./Ast.ts";
import type { Ready } from "./Ready.ts";
import { chartShape } from "./chartShape.ts";
import { flowsIn } from "./flowsIn.ts";

const parsed = new WeakMap<SourceFile, Ast>();

/**
 * The flows of `file` whose chart was read: from `file` itself when it declares the chart, else from the chart file
 * among `project`, the project's code files, whether or not that file is itself checked. The language follows the
 * chart file's extension.
 */
export function readyFlows({ file, ast, project }: RuleInput): Ready[] {
  const out: Ready[] = [];
  for (const flow of flowsIn(file.path, ast)) {
    const at = flow.chart.path;
    const f = project.find((p) => p.path === at);
    const c = at === file.path ? ast : f && (parsed.get(f) ?? parsed.set(f, parseSync(at, f.source).program).get(f));
    const shape = c && chartShape(c, flow.chart);
    if (shape) out.push({ flow, shape, source: file.source });
  }
  return out;
}
