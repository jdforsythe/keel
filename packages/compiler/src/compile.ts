import type { Analysis } from "./internal/Analysis.ts";
import type { BindingInfo } from "./internal/BindingInfo.ts";
import type { ElementInfo } from "./internal/ElementInfo.ts";
import { analyze } from "./internal/analyze.ts";
import { buildDeps } from "./internal/buildDeps.ts";
import { canonicalJson } from "./internal/canonicalJson.ts";
import { clientOnly } from "./internal/clientOnly.ts";
import { collectElements } from "./internal/collectElements.ts";
import { collectStyles } from "./internal/collectStyles.ts";
import { diag } from "./internal/diag.ts";
import { hashOf } from "./internal/hashOf.ts";
import { internalFailure } from "./internal/internalFailure.ts";
import { lowerFile } from "./internal/lowerFile.ts";
import { ruleAndJsx } from "./internal/rules/ruleAndJsx.ts";
import { ruleControlFlow } from "./internal/rules/ruleControlFlow.ts";
import { rulePropsDestructuring } from "./internal/rules/rulePropsDestructuring.ts";
import { ruleRawHtml } from "./internal/rules/ruleRawHtml.ts";
import { ruleServerImport } from "./internal/rules/ruleServerImport.ts";
import { ruleTopLevelPropRead } from "./internal/rules/ruleTopLevelPropRead.ts";
import { ruleUrlLiteral } from "./internal/rules/ruleUrlLiteral.ts";
import type { A11yEntry } from "./types/A11yEntry.ts";
import type { Artifacts } from "./types/Artifacts.ts";
import type { CompileOptions } from "./types/CompileOptions.ts";
import type { CompileResult } from "./types/CompileResult.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { IdEntry } from "./types/IdEntry.ts";
import type { RouteEntry } from "./types/RouteEntry.ts";
import type { SourceFile } from "./types/SourceFile.ts";
import type { StyleUsage } from "./types/StyleUsage.ts";

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

/** E1000 message: the parser's message on one line, `syntax error: ` first, under 90 chars. */
function syntaxMessage(parser: string): string {
  const text = `syntax error: ${parser.replace(/\s*\n\s*/g, " ").trim()}`;
  return text.length > 89 ? `${text.slice(0, 86)}...` : text;
}

/**
 * Compile Keel sources (k.compiler): lower JSX to k.runtime ops, run the compile-time rules, and derive
 * the `.keel/` artifacts. Pure and deterministic: equal inputs give byte-identical results; nothing is
 * read from or written to disk. `mode: "server"` currently emits the same client module (see PLAN D9).
 * `topology` exempts client-only deployables from E1004; `routes` is copied (sorted) into `routes.json`, and its
 * path patterns scope E1501 for relative literals. A file that does not parse gets only E1000: no
 * elements, deps, or output. Anything thrown inside is rethrown as E1049 (`internalFailure`), never as an app code.
 */
export function compile(files: readonly SourceFile[], options: CompileOptions = {}): CompileResult {
  try {
    return compileFiles(files, options);
  } catch (e) {
    throw internalFailure(e);
  }
}

function compileFiles(files: readonly SourceFile[], options: CompileOptions): CompileResult {
  void options.mode;
  const patterns = Object.values(options.routes ?? {}).flatMap((r) => (typeof r?.path === "string" ? [r.path] : []));
  const diagnostics: Diagnostic[] = [];
  const usages = new Map<string, StyleUsage>();
  const done: { a: Analysis; elements: ElementInfo[]; bindings: BindingInfo[]; code: string }[] = [];
  for (const file of files) {
    const a = analyze(file);
    if (a.parseErrors.length > 0) {
      for (const e of a.parseErrors)
        diagnostics.push(diag(a, "E1000", e.start, syntaxMessage(e.message), "k.compiler"));
      continue;
    }
    const destructuring = rulePropsDestructuring(a);
    diagnostics.push(
      ...ruleRawHtml(a),
      ...ruleUrlLiteral(a, patterns),
      ...ruleServerImport(a, clientOnly(a.path, options.topology)),
      ...ruleAndJsx(a),
      ...ruleControlFlow(a),
      ...ruleTopLevelPropRead(a),
      ...destructuring.diagnostics,
    );
    const elements = collectElements(a);
    const styles = collectStyles(a);
    for (const u of styles.usages) usages.set(canonicalJson(u), u);
    const lowered = lowerFile(a, elements, destructuring.edits, styles.rewrites);
    done.push({ a, elements, bindings: lowered.bindings, code: lowered.code });
  }
  diagnostics.push(...duplicateIds(done));

  const ids: Record<string, IdEntry> = Object.create(null);
  const a11y: Record<string, A11yEntry> = Object.create(null);
  const all = done.flatMap((d) => d.elements).sort((x, y) => cmp(x.id, y.id));
  for (const e of all) {
    if (Object.hasOwn(ids, e.id)) continue;
    ids[e.id] = { col: e.col, component: e.component, file: e.file, line: e.line, role: e.role, tag: e.tag };
    a11y[e.id] = { name: e.name, role: e.role, tag: e.tag };
  }
  const routes: Record<string, RouteEntry> = Object.create(null);
  const given = options.routes ?? {};
  for (const id of Object.keys(given).sort(cmp)) {
    const entry = given[id];
    if (entry !== undefined) routes[id] = entry;
  }
  const artifacts: Artifacts = {
    "a11y.json": a11y,
    "deps.json": buildDeps(done),
    "ids.json": ids,
    "routes.json": routes,
    "styles.json": { usages: [...usages.keys()].sort(cmp).flatMap((k) => usages.get(k) ?? []) },
  };
  return {
    artifacts,
    diagnostics: diagnostics.sort(byLocation),
    hashes: {
      "a11y.json": hashOf(artifacts["a11y.json"]),
      "deps.json": hashOf(artifacts["deps.json"]),
      "ids.json": hashOf(artifacts["ids.json"]),
      "routes.json": hashOf(artifacts["routes.json"]),
      "styles.json": hashOf(artifacts["styles.json"]),
    },
    outputs: done.map((d) => ({ path: d.a.path, code: d.code })),
  };
}
