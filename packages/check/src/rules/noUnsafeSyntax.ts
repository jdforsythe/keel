import { Visitor, parseSync } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isCodePath } from "../internal/isCodePath.ts";
import { langOf } from "../internal/langOf.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const SUPPRESSION = new RegExp(`@ts-(?:${["ignore", "expect-error", "nocheck"].join("|")})\\b`);

const WHAT: Readonly<Record<string, string>> = {
  cast: "type cast",
  nonnull: "non-null assertion",
  any: "any",
  suppress: "ts suppression comment",
};

/**
 * E1757 (k.check; CLAUDE.md rule 6): `as T` (not `as const`), `<T>x`, `x!`, `any`, or a ts-suppression
 * comment in a code file outside `unsafe/`. Fixes: `x!` -> `x`, `any` -> `unknown`, delete the comment.
 */
export const noUnsafeSyntax: RuleDef = {
  code: "E1757",
  message: (f) => `${WHAT[str(f.data, "kind")] ?? "unsafe syntax"} outside unsafe/; use a guard or move it to unsafe/`,
  explain: "Casts, !, any, and ts suppressions defeat the type system. Narrow with a guard, or isolate in unsafe/.",
  see: "k.check",
  check: ({ file, ast }) => {
    if (!isCodePath(file.path) || /(?:^|\/)(?:unsafe|\.keel|node_modules)\//.test(file.path)) return [];
    const out: Finding[] = [];
    const hit = (kind: string, at: number, start: number, end: number, text: string): void =>
      void out.push(findingAt(file, at, { kind, start, end, text }));
    new Visitor({
      TSAsExpression: (n) => {
        const t = n.typeAnnotation;
        const isConst = t.type === "TSTypeReference" && t.typeName.type === "Identifier" && t.typeName.name === "const";
        if (!isConst) hit("cast", n.start, 0, 0, "");
      },
      TSTypeAssertion: (n) => hit("cast", n.start, 0, 0, ""),
      TSNonNullExpression: (n) => hit("nonnull", n.start, n.end - 1, n.end, ""),
      TSAnyKeyword: (n) => hit("any", n.start, n.start, n.end, "unknown"),
    }).visit(ast);
    const src = file.source;
    for (const c of parseSync(file.path, src, { sourceType: "module", lang: langOf(file.path) }).comments) {
      if (!SUPPRESSION.test(c.value)) continue;
      // a comment alone on its line takes the line with it; a trailing comment goes with its leading blanks
      const lineStart = src.lastIndexOf("\n", c.start - 1) + 1;
      const eol = src.indexOf("\n", c.end);
      const lineEnd = eol === -1 ? src.length : eol + 1;
      const alone =
        src.slice(lineStart, c.start).trim() === "" && src.slice(c.end, eol === -1 ? src.length : eol).trim() === "";
      const start = alone
        ? lineStart
        : c.start - (src.slice(lineStart, c.start).length - src.slice(lineStart, c.start).trimEnd().length);
      hit("suppress", c.start, start, alone ? lineEnd : c.end, "");
    }
    return out.sort((a, b) => a.line - b.line || a.col - b.col);
  },
  fix: (f) => {
    const start = num(f.data, "start", 0);
    const end = num(f.data, "end", 0);
    if (end <= start) return null;
    return [{ start, end, text: str(f.data, "text") }];
  },
};
