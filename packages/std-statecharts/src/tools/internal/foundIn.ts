import { analyze } from "../../internal/analyze.ts";
import type { Found } from "./Found.ts";
import { chartCalls } from "./chartCalls.ts";
import { literalShape } from "./literalShape.ts";
import { nearest } from "./nearest.ts";
import { unreachable } from "./unreachable.ts";

const memo = new WeakMap<object, readonly Found[]>();

/**
 * Every E2751-E2755 hit in a file's AST, once per AST. A chart with a non-literal part reports E2755 only: the rest of
 * its declaration cannot be proven.
 */
export function foundIn(ast: object): readonly Found[] {
  const known = memo.get(ast);
  if (known !== undefined) return known;
  const out: Found[] = [];
  for (const call of chartCalls(ast)) {
    const { shape, loose } = literalShape(call);
    for (const at of loose)
      out.push({ code: "E2755", at, message: "chart part is not a literal, so keel check cannot prove the chart" });
    if (shape === undefined) continue;
    out.push(...analyze(shape, nearest));
    for (const st of unreachable(shape))
      out.push({ code: "E2752", at: st.at, message: `state '${st.name}' is unreachable from '${shape.initial.name}'` });
  }
  memo.set(ast, out);
  return out;
}
