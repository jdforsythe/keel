// Helpers for the rule tests: sources parsed as the checker parses them, and a rule run over a project tree.
import type { Edit, RuleDef, SourceFile } from "@keel/check";
import { type Expression, type Program, parseSync } from "oxc-parser";

/** The AST of `source`; `.tsx` and `.jsx` paths parse as TSX unless `lang` says otherwise. */
export function program(path: string, source: string, lang: "ts" | "tsx" = path.endsWith("x") ? "tsx" : "ts"): Program {
  return parseSync(path, source, { sourceType: "module", lang }).program;
}

/** Offset of `source` inside the file `expr` parses: `const v = <source>`. */
export const EXPR_AT = "const v = ".length;

/** The expression `source` as a parsed node; its offsets are `EXPR_AT` past those in `source`. */
export function expr(source: string): Expression {
  const st = program("x.ts", `const v = ${source}\n`).body[0];
  const init = st?.type === "VariableDeclaration" ? st.declarations[0]?.init : undefined;
  if (init === undefined || init === null) throw new Error(`not an expression: ${source}`);
  return init;
}

/** Offset of the first `needle` in `source`; throws when absent, so a typo cannot pass as -1. */
export function at(source: string, needle: string): number {
  const i = source.indexOf(needle);
  if (i < 0) throw new Error(`no '${needle}' in source`);
  return i;
}

export type Found = { readonly at: string; readonly message: string; readonly fix: readonly Edit[] | null };

/** What `rule` reports on `path` of the project `files`: `line:col`, the message and the fix edits. */
export function run(rule: RuleDef, files: Readonly<Record<string, string>>, path: string): Found[] {
  const project: SourceFile[] = Object.entries(files).map(([p, source]) => ({ path: p, source }));
  const file = project.find((f) => f.path === path);
  if (file === undefined) throw new Error(`no file ${path}`);
  const ast = program(path, file.source);
  return rule.check({ file, ast, artifacts: {}, project }).map((f) => ({
    at: `${f.line}:${f.col}`,
    message: typeof rule.message === "function" ? rule.message(f) : rule.message,
    fix: rule.fix?.(f, { file, ast }) ?? null,
  }));
}

/** `source` with `edits` applied. */
export function applied(source: string, edits: readonly Edit[]): string {
  return [...edits]
    .sort((a, b) => b.start - a.start)
    .reduce((s, e) => s.slice(0, e.start) + e.text + s.slice(e.end), source);
}

/** `line:col` of the first `needle` in `source`, 1-based, as `run` reports positions. */
export function pos(source: string, needle: string): string {
  const before = source.slice(0, at(source, needle));
  return `${before.split("\n").length}:${before.length - before.lastIndexOf("\n")}`;
}
