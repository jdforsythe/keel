import * as reactive from "@keel/reactive";
import * as runtimeDom from "@keel/runtime-dom";
import * as ops from "@keel/runtime-dom/ops";
import * as schema from "@keel/schema";
import * as store from "@keel/store";
import * as ui from "@keel/ui";
import type { Program } from "oxc-parser";
import ts from "typescript";
import { loadComponent } from "../../unsafe/loadComponent.ts";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { lineCol } from "./lineCol.ts";
import { withDom } from "./withDom.ts";

/** The modules a rendered component may import: the kernel runtime and `@keel/ui`. */
const MODULES: ReadonlyMap<string, unknown> = new Map<string, unknown>([
  ["@keel/reactive", reactive],
  ["@keel/runtime-dom", runtimeDom],
  ["@keel/runtime-dom/ops", ops],
  ["@keel/schema", schema],
  ["@keel/store", store],
  ["@keel/ui", ui],
]);

const memo = new Map<string, Diagnostic[]>();
const MEMO_MAX = 128;

function requireKernel(id: string): unknown {
  const m = MODULES.get(id);
  if (m === undefined) throw new Error(`rendered check: cannot import ${id}`);
  return m;
}

/** Offset of the default export, or -1 when the module has none. */
function defaultExportAt(program: Program): number {
  return program.body.find((s) => s.type === "ExportDefaultDeclaration")?.start ?? -1;
}

/** Only runnable when every value import is a module the check can supply. */
function importsSupported(program: Program): boolean {
  return program.body.every(
    (s) => s.type !== "ImportDeclaration" || s.importKind === "type" || MODULES.has(s.source.value),
  );
}

function named(el: Element, root: Element): boolean {
  const aria = el.getAttribute("aria-label") ?? el.getAttribute("aria-labelledby") ?? el.getAttribute("title") ?? "";
  if (aria.trim() !== "") return true;
  const id = el.getAttribute("id");
  if (id !== null && root.querySelector(`label[for="${id.replace(/"/g, '\\"')}"]`) !== null) return true;
  return el.closest("label") !== null;
}

/** Structural a11y violations of a rendered tree: `[tag, missing name source]` per offending element. */
function violations(root: Element): [string, string][] {
  const out: [string, string][] = [];
  for (const el of Array.from(root.querySelectorAll("*"))) {
    if (el.closest('[aria-hidden="true"]') !== null) continue;
    const tag = el.tagName.toLowerCase();
    const text = (el.textContent ?? "").trim() !== "";
    if (
      tag === "img" &&
      el.getAttribute("alt") === null &&
      !/^(?:presentation|none)$/.test(el.getAttribute("role") ?? "")
    )
      out.push([tag, "alt"]);
    else if ((tag === "input" && el.getAttribute("type") !== "hidden") || tag === "textarea" || tag === "select") {
      if (!named(el, root)) out.push([tag, "label"]);
    } else if ((tag === "button" || (tag === "a" && el.hasAttribute("href"))) && !text && !named(el, root))
      out.push([tag, "text or label"]);
  }
  return out;
}

/**
 * Pipeline step 4 (k.check): render each component module once (compiled output, empty props) and report
 * structural a11y violations of the rendered tree as E1802 at the default export. Modules that import
 * anything besides the kernel runtime and `@keel/ui`, or that throw while rendering, are not rendered.
 */
export function renderA11y(file: SourceFile, compiled: string, program: Program): Diagnostic[] {
  const at = defaultExportAt(program);
  if (at < 0 || !/\.[jt]sx$/.test(file.path) || !importsSupported(program)) return [];
  const key = `${file.path}\u0000${file.source}`;
  const hit = memo.get(key);
  if (hit !== undefined) return hit;
  const js = ts.transpileModule(compiled, {
    fileName: file.path.replace(/\.[jt]sx$/, ".ts"),
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, verbatimModuleSyntax: false },
  }).outputText;
  const found = withDom((doc) => {
    const host = doc.createElement("div");
    let dispose = (): void => {};
    try {
      const component = loadComponent(js, requireKernel);
      if (component === null) return [];
      dispose = runtimeDom.mount(component, host);
      return violations(host);
    } catch {
      return [];
    } finally {
      dispose();
    }
  });
  const { line, col } = lineCol(file.source, at);
  const out: Diagnostic[] = found.map(([tag, missing]) => ({
    kind: "diag",
    code: "E1802",
    path: file.path,
    line,
    col,
    message: `rendered <${tag}> has no accessible name (${missing})`,
    see: "k.ui",
  }));
  if (memo.size >= MEMO_MAX) {
    const first = memo.keys().next();
    if (first.done !== true) memo.delete(first.value);
  }
  memo.set(key, out);
  return out;
}
