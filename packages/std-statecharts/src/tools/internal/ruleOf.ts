import type { Edit, Finding, RuleDef } from "@keel/check";
import type { Found } from "./Found.ts";
import { foundIn } from "./foundIn.ts";

const lineCol = (source: string, at: number): { line: number; col: number } => {
  const before = source.slice(0, at);
  return { line: before.split("\n").length, col: at - before.lastIndexOf("\n") };
};

/**
 * The `check`, `message` and `fix` of the statecharts rule `code`: findings at each hit with its message and, when
 * the hit has one, an edit replacing its node (E2751 keeps the literal's quote).
 */
export function ruleOf(code: string): Pick<RuleDef, "check" | "message" | "fix"> {
  return {
    message: (f) => String(f.data?.message ?? code),
    check: ({ file, ast }): Finding[] =>
      foundIn(ast)
        .filter((h: Found) => h.code === code)
        .map((h) => {
          const q = file.source[h.at.start] ?? "'";
          const text = h.fix === undefined ? undefined : code === "E2751" ? `${q}${h.fix}${q}` : h.fix;
          return {
            path: file.path,
            ...lineCol(file.source, h.at.start),
            data: { message: h.message, start: h.at.start, end: h.at.end, ...(text === undefined ? {} : { text }) },
          };
        }),
    fix: (f): Edit[] | null => {
      const { start, end, text } = f.data ?? {};
      return typeof start === "number" && typeof end === "number" && typeof text === "string"
        ? [{ start, end, text }]
        : null;
    },
  };
}
