import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The fewest words a justification string holds (k.unsafe Reason). */
const MIN_WORDS = 8;

/** Words in `text`: runs of non-space characters holding a letter or digit. */
function words(text: string): number {
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/**
 * E1760 (k.unsafe): an `unsafe(` justification string, a string literal or a template without substitutions holding a
 * non-space character, of fewer than 8 words, at the string. The call still lifts its range (E1754 decides that).
 */
export const unsafeReasonWords: RuleDef = {
  code: "E1760",
  message: `unsafe justification under ${MIN_WORDS} words; state the invariant and where it is enforced`,
  see: "k.unsafe",
  check: ({ file, ast }) => {
    if (!isCodePath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type !== "Identifier" || n.callee.name !== "unsafe") return;
        const a = n.arguments[0];
        const text =
          a?.type === "Literal" && typeof a.value === "string"
            ? a.value
            : a?.type === "TemplateLiteral" && a.expressions.length === 0
              ? a.quasis.map((q) => q.value.cooked ?? "").join("")
              : null;
        if (a === undefined || text === null || text.trim() === "") return;
        if (words(text) < MIN_WORDS) out.push(findingAt(file, a.start));
      },
    }).visit(ast);
    return out;
  },
};
