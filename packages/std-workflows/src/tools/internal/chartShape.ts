import { chartCalls, literalShape, unwrap } from "@keel/std-statecharts/tools/internal";
import type { Ast } from "./Ast.ts";
import type { Flow } from "./Flow.ts";

/** The literal shape of a flow's chart in `ast`, the file that declares it; undefined when it is not a literal. */
export function chartShape(ast: Ast, chart: Flow["chart"]): ReturnType<typeof literalShape>["shape"] {
  let start = chart.start;
  for (const st of ast.body) {
    const d = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (d?.type !== "VariableDeclaration") continue;
    for (const v of d.declarations)
      if (v.id.type === "Identifier" && v.id.name === chart.name) start = unwrap(v.init)?.start;
  }
  const call = chartCalls(ast).find((n) => n.start === start);
  return call === undefined ? undefined : literalShape(call).shape;
}
