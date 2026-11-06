import type { Analysis } from "./internal/Analysis.ts";
import type { BindingInfo } from "./internal/BindingInfo.ts";
import type { ElementInfo } from "./internal/ElementInfo.ts";
import { analyze } from "./internal/analyze.ts";
import { buildDeps } from "./internal/buildDeps.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { collectElements } from "./internal/collectElements.ts";
import { diag } from "./internal/diag.ts";
import { fnv1a } from "./internal/fnv1a.ts";
import { lowerFile } from "./internal/lowerFile.ts";
import { ruleAndJsx } from "./internal/rules/ruleAndJsx.ts";
import { ruleControlFlow } from "./internal/rules/ruleControlFlow.ts";
import { rulePropsDestructuring } from "./internal/rules/rulePropsDestructuring.ts";
import { ruleRawHtml } from "./internal/rules/ruleRawHtml.ts";
import { ruleServerImport } from "./internal/rules/ruleServerImport.ts";
import { ruleUrlLiteral } from "./internal/rules/ruleUrlLiteral.ts";
import type { A11yEntry } from "./types/A11yEntry.ts";
import type { Artifacts } from "./types/Artifacts.ts";
import type { CompileOptions } from "./types/CompileOptions.ts";
import type { CompileResult } from "./types/CompileResult.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { IdEntry } from "./types/IdEntry.ts";
import type { SourceFile } from "./types/SourceFile.ts";

const cmp = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);

function byLocation(x: Diagnostic, y: Diagnostic): number {
  return cmp(x.path, y.path) || x.line - y.line || x.col - y.col || cmp(x.code, y.code) || cmp(x.message, y.message);
}

function duplicateIds(all: readonly { a: Analysis; elements: readonly ElementInfo[] }[]): Diagnostic[] {
  const first = new Map<string, ElementInfo>();
  const out: Diagnostic[] = [];
  for (const { a, elements } of all) {
    for (const e of elements) {
      const prior = first.get(e.id);
      if (prior === undefined) {
        first.set(e.id, e);
        continue;
      }
      const where = `${prior.file}:${prior.line}:${prior.col}`;
      out.push(
        diag(
          a,
          "E1404",
          e.start,
          `duplicate element id "${e.id.slice(0, 30)}" (first at ${where.slice(-40)})`,
          "k.component",
        ),
      );
    }
  }
  return out;
}

/**
 * Compile Keel sources (k.compiler): lower JSX to k.runtime ops, run the compile-time rules, and derive
 * the `.keel/` artifacts. Pure and deterministic: equal inputs give byte-identical results; nothing is
 * read from or written to disk. `mode: "server"` currently emits the same client module (see PLAN D9).
 */
export function compile(files: readonly SourceFile[], options: CompileOptions = {}): CompileResult {
  void options.mode;
  const diagnostics: Diagnostic[] = [];
  const done: { a: Analysis; elements: ElementInfo[]; bindings: BindingInfo[]; code: string }[] = [];
  for (const file of files) {
    const a = analyze(file);
    for (const e of a.parseErrors)
      diagnostics.push(diag(a, "E1000", e.start, `syntax error: ${e.message.slice(0, 70)}`, "k.compiler"));
    const destructuring = rulePropsDestructuring(a);
    diagnostics.push(
      ...ruleRawHtml(a),
      ...ruleUrlLiteral(a),
      ...ruleServerImport(a),
      ...ruleAndJsx(a),
      ...ruleControlFlow(a),
      ...destructuring.diagnostics,
    );
    const elements = collectElements(a);
    const lowered =
      a.parseErrors.length > 0 ? { code: a.source, bindings: [] } : lowerFile(a, elements, destructuring.edits);
    done.push({ a, elements, bindings: lowered.bindings, code: lowered.code });
  }
  diagnostics.push(...duplicateIds(done));

  const ids: Record<string, IdEntry> = {};
  const a11y: Record<string, A11yEntry> = {};
  const all = done.flatMap((d) => d.elements).sort((x, y) => cmp(x.id, y.id));
  for (const e of all) {
    if (e.id in ids) continue;
    ids[e.id] = { col: e.col, component: e.component, file: e.file, line: e.line, role: e.role, tag: e.tag };
    a11y[e.id] = { name: e.name, role: e.role, tag: e.tag };
  }
  const artifacts: Artifacts = {
    "a11y.json": a11y,
    "deps.json": buildDeps(done),
    "ids.json": ids,
    "routes.json": {},
  };
  const hash = (v: unknown): string => `fnv1a:${fnv1a(canonicalJson(v))}`;
  return {
    artifacts,
    diagnostics: diagnostics.sort(byLocation),
    hashes: {
      "a11y.json": hash(artifacts["a11y.json"]),
      "deps.json": hash(artifacts["deps.json"]),
      "ids.json": hash(artifacts["ids.json"]),
      "routes.json": hash(artifacts["routes.json"]),
    },
    outputs: done.map((d) => ({ path: d.a.path, code: d.code })),
  };
}
