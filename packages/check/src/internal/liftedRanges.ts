import { Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { parseFile } from "./parseFile.ts";

/** The `[start, end)` offsets of one lifted range. */
type Range = readonly [number, number];

/**
 * The lifted ranges of a file (k.check, App code): in a file under `unsafe/`, the arrow function or function
 * expression written as the second argument of an `unsafe(` call whose first argument is a justification string (a
 * string literal or a template without substitutions holding a non-space character), from its first character to its
 * last. A name or a call as the second argument, a call without a justification and a file outside `unsafe/` give none.
 */
export function liftedRanges(file: SourceFile): readonly Range[] {
  if (!/(?:^|\/)unsafe\//.test(file.path)) return [];
  const parsed = parseFile(file);
  if (!parsed.ok) return [];
  const out: Range[] = [];
  new Visitor({
    CallExpression: (n) => {
      if (n.callee.type !== "Identifier" || n.callee.name !== "unsafe") return;
      const a = n.arguments[0];
      const fn = n.arguments[1];
      const why =
        (a?.type === "Literal" && typeof a.value === "string" && a.value.trim() !== "") ||
        (a?.type === "TemplateLiteral" &&
          a.expressions.length === 0 &&
          a.quasis.some((q) => (q.value.cooked ?? "").trim() !== ""));
      if (why && (fn?.type === "ArrowFunctionExpression" || fn?.type === "FunctionExpression"))
        out.push([fn.start, fn.end]);
    },
  }).visit(parsed.program);
  return out;
}
