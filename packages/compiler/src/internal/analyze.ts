import { type ParamPattern, Visitor, parseSync } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Analysis } from "./Analysis.ts";
import type { FnInfo } from "./FnInfo.ts";
import type { IdentRef } from "./IdentRef.ts";
import type { IntrinsicKind } from "./IntrinsicKind.ts";
import type { ReactiveDecl } from "./ReactiveDecl.ts";
import type { Span } from "./Span.ts";

const INTRINSICS: ReadonlySet<string> = new Set(["If", "For", "Match", "Case", "Boundary"]);
const REACTIVE: ReadonlySet<string> = new Set(["signal", "computed", "resource"]);

function isIntrinsic(name: string): name is IntrinsicKind {
  return INTRINSICS.has(name);
}

function isReactiveKind(name: string): name is ReactiveDecl["kind"] {
  return REACTIVE.has(name);
}

function langOf(path: string): "js" | "jsx" | "ts" | "tsx" {
  if (/\.tsx$/.test(path)) return "tsx";
  if (/\.ts$/.test(path)) return "ts";
  if (/\.jsx$/.test(path)) return "jsx";
  if (/\.[cm]?js$/.test(path)) return "js";
  return "tsx";
}

function stemOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.[cm]?[jt]sx?$/, "");
}

const span = (n: Span): Span => ({ start: n.start, end: n.end });
const inside = (spans: Span[], n: Span): boolean => spans.some((s) => s.start <= n.start && n.end <= s.end);

/** Parse one file with oxc and collect, in one visit, everything lowering and rules need. */
export function analyze(file: SourceFile): Analysis {
  const parsed = parseSync(file.path, file.source, { sourceType: "module", lang: langOf(file.path) });
  const program = parsed.program;
  const a: Analysis = {
    path: file.path,
    source: file.source,
    stem: stemOf(file.path),
    program,
    parseErrors: parsed.errors.map((e) => ({ message: e.message, start: e.labels[0]?.start ?? 0 })),
    jsx: [],
    imports: [],
    intrinsics: new Map(),
    functions: [],
    idents: [],
    bindings: [],
    members: [],
    logicals: [],
    reactive: [],
    consts: new Map(),
    effects: [],
  };
  const excluded: Span[] = [];
  const candidates: { name: string; start: number; end: number }[] = [];
  const shorthand = new Set<number>();
  const fnNames = new Map<number, string>();
  const params = (ps: ParamPattern[]): void => {
    for (const p of ps) a.bindings.push(span(p));
  };
  const fn = (node: FnInfo["node"]): void => {
    a.functions.push({ start: node.start, end: node.end, name: fnNames.get(node.start) ?? null, node });
    params(node.params);
  };

  new Visitor({
    JSXElement: (n) => void a.jsx.push(n),
    JSXFragment: (n) => void a.jsx.push(n),
    ImportDeclaration: (n) => {
      a.imports.push(n);
      a.bindings.push(span(n));
      if (n.source.value !== "@keel/runtime-dom") return;
      for (const s of n.specifiers) {
        if (s.type !== "ImportSpecifier") continue;
        const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value;
        if (isIntrinsic(imported)) a.intrinsics.set(s.local.name, imported);
      }
    },
    FunctionDeclaration: (n) => {
      if (n.id) {
        fnNames.set(n.start, n.id.name);
        a.bindings.push(span(n.id));
      }
      fn(n);
    },
    FunctionExpression: (n) => {
      if (n.id) {
        if (!fnNames.has(n.start)) fnNames.set(n.start, n.id.name);
        a.bindings.push(span(n.id));
      }
      fn(n);
    },
    ArrowFunctionExpression: (n) => fn(n),
    VariableDeclarator: (n) => {
      a.bindings.push(span(n.id));
      const init = n.init;
      if (n.id.type !== "Identifier" || init === null) return;
      const name = n.id.name;
      if (init.type === "ArrowFunctionExpression" || init.type === "FunctionExpression") fnNames.set(init.start, name);
      if (!a.consts.has(name)) a.consts.set(name, init);
      if (init.type === "CallExpression" && init.callee.type === "Identifier" && isReactiveKind(init.callee.name)) {
        a.reactive.push({ name, kind: init.callee.name, start: n.start, end: n.end, init: span(init) });
      }
    },
    CallExpression: (n) => {
      if (n.callee.type === "Identifier" && n.callee.name === "effect") a.effects.push(span(n));
    },
    CatchClause: (n) => {
      if (n.param) a.bindings.push(span(n.param));
    },
    ClassDeclaration: (n) => {
      if (n.id) a.bindings.push(span(n.id));
    },
    MemberExpression: (n) => {
      if (n.computed) return;
      excluded.push(span(n.property));
      a.members.push({ name: n.property.name, start: n.property.start, end: n.property.end });
    },
    Property: (n) => {
      if (n.shorthand) shorthand.add(n.key.start);
      else if (!n.computed) excluded.push(span(n.key));
    },
    MethodDefinition: (n) => {
      if (!n.computed) excluded.push(span(n.key));
    },
    PropertyDefinition: (n) => {
      if (!n.computed) excluded.push(span(n.key));
    },
    LabeledStatement: (n) => void excluded.push(span(n.label)),
    BreakStatement: (n) => {
      if (n.label) excluded.push(span(n.label));
    },
    ContinueStatement: (n) => {
      if (n.label) excluded.push(span(n.label));
    },
    TSTypeAnnotation: (n) => void excluded.push(span(n)),
    TSTypeParameterInstantiation: (n) => void excluded.push(span(n)),
    TSTypeParameterDeclaration: (n) => void excluded.push(span(n)),
    TSInterfaceDeclaration: (n) => void excluded.push(span(n)),
    TSTypeAliasDeclaration: (n) => void excluded.push(span(n)),
    TSAsExpression: (n) => void excluded.push(span(n.typeAnnotation)),
    TSSatisfiesExpression: (n) => void excluded.push(span(n.typeAnnotation)),
    TSTypeAssertion: (n) => void excluded.push(span(n.typeAnnotation)),
    LogicalExpression: (n) => void a.logicals.push(n),
    Identifier: (n) => void candidates.push({ name: n.name, start: n.start, end: n.end }),
  }).visit(program);

  a.jsx.sort((x, y) => x.start - y.start || y.end - x.end);
  const seen = new Set<number>();
  const idents: IdentRef[] = [];
  for (const c of candidates) {
    if (seen.has(c.start)) continue;
    seen.add(c.start);
    if (inside(excluded, c) || inside(a.bindings, c)) continue;
    idents.push({ ...c, shorthand: shorthand.has(c.start) });
  }
  a.idents = idents.sort((x, y) => x.start - y.start);
  for (const f of a.functions) if (f.name === null) f.name = fnNames.get(f.start) ?? null;
  return a;
}
