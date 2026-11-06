import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** E1754 (k.check): `unsafe(...)` whose first argument is not a non-empty string literal (the justification). */
export const unsafeJustified: RuleDef = {
  code: "E1754",
  message: "unsafe call needs a justification string as its first argument",
  explain: "Every unsafe use states why: unsafe('reason', () => ...). Reviews count and audit them.",
  see: "k.check",
  check: ({ file, ast }) => {
    if (!isCodePath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type !== "Identifier" || n.callee.name !== "unsafe") return;
        const a = n.arguments[0];
        const literal =
          (a?.type === "Literal" && typeof a.value === "string" && a.value.trim() !== "") ||
          (a?.type === "TemplateLiteral" &&
            a.expressions.length === 0 &&
            a.quasis.some((q) => (q.value.cooked ?? "").trim() !== ""));
        if (!literal) out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
