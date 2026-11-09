import { type ParamPattern, Visitor, parseSync } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Analysis } from "./Analysis.ts";
import type { FnInfo } from "./FnInfo.ts";
import type { IdentRef } from "./IdentRef.ts";
import type { IntrinsicKind } from "./IntrinsicKind.ts";
import type { ReactiveDecl } from "./ReactiveDecl.ts";
import type { Span } from "./Span.ts";
import { coverage } from "./coverage.ts";
import { patternIdents } from "./patternIdents.ts";
import { patternNames } from "./patternNames.ts";

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

const EXT = /\.[cm]?[jt]sx?$/;

function stemOf(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(EXT, "");
}

/** Project-root-relative path without extension, `/` replaced by `.` (k.component derived ids). */
function idPrefixOf(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(EXT, "").split("/").join(".");
}

const span = (n: Span): Span => ({ start: n.start, end: n.end });

/** Parse one file with oxc and collect, in one visit, everything lowering and rules need. */
export function analyze(file: SourceFile): Analysis {
  const parsed = parseSync(file.path, file.source, { sourceType: "module", lang: langOf(file.path) });
  const program = parsed.program;
  const a: Analysis = {
    path: file.path,
    source: file.source,
    stem: stemOf(file.path),
    idPrefix: idPrefixOf(file.path),
    program,
    parseErrors: parsed.errors.map((e) => ({ message: e.message, start: e.labels[0]?.start ?? 0 })),
    jsx: [],
    imports: [],
    intrinsics: new Map(),
    functions: [],
    idents: [],
    identsByName: new Map(),
    decls: new Map(),
    bindings: [],
    members: [],
    logicals: [],
    reactive: [],
    consts: new Map(),
    effects: [],
    calls: [],
  };
  const excluded: Span[] = [];
  const candidates: { name: string; start: number; end: number }[] = [];
  const shorthand = new Set<number>();
  const fnNames = new Map<number, string>();
  const programScope = span(program);
  const scopes: Span[] = [programScope];
  const fnScopes: Span[] = [programScope];
  const top = (stack: Span[]): Span => stack[stack.length - 1] ?? programScope;
  const declare = (names: string[], scope: Span): void => {
    for (const n of names) {
      const list = a.decls.get(n);
      if (list === undefined) a.decls.set(n, [scope]);
      else list.push(scope);
    }
  };
  const enterScope = (n: Span): void => void scopes.push(span(n));
  const exitScope = (): void => void scopes.pop();
  const params = (ps: ParamPattern[], scope: Span): void => {
    for (const p of ps) {
      a.bindings.push(...patternIdents(p));
      declare(patternNames(p), scope);
    }
  };
  const fn = (node: FnInfo["node"]): void => {
    a.functions.push({ start: node.start, end: node.end, name: fnNames.get(node.start) ?? null, node });
    const scope = span(node);
    scopes.push(scope);
    fnScopes.push(scope);
    params(node.params, scope);
  };
  const fnExit = (): void => {
    scopes.pop();
    fnScopes.pop();
  };

  new Visitor({
    JSXElement: (n) => void a.jsx.push(n),
    JSXFragment: (n) => void a.jsx.push(n),
    ImportDeclaration: (n) => {
      a.imports.push(n);
      a.bindings.push(span(n));
      declare(
        n.specifiers.map((x) => x.local.name),
        programScope,
      );
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
        declare([n.id.name], top(scopes));
      }
      fn(n);
    },
    "FunctionDeclaration:exit": fnExit,
    FunctionExpression: (n) => {
      if (n.id) {
        if (!fnNames.has(n.start)) fnNames.set(n.start, n.id.name);
        a.bindings.push(span(n.id));
        declare([n.id.name], span(n));
      }
      fn(n);
    },
    "FunctionExpression:exit": fnExit,
    ArrowFunctionExpression: (n) => fn(n),
    "ArrowFunctionExpression:exit": fnExit,
    BlockStatement: enterScope,
    "BlockStatement:exit": exitScope,
    ForStatement: enterScope,
    "ForStatement:exit": exitScope,
    ForInStatement: enterScope,
    "ForInStatement:exit": exitScope,
    ForOfStatement: enterScope,
    "ForOfStatement:exit": exitScope,
    SwitchStatement: enterScope,
    "SwitchStatement:exit": exitScope,
    StaticBlock: enterScope,
    "StaticBlock:exit": exitScope,
    VariableDeclaration: (n) => {
      const scope = n.kind === "var" ? top(fnScopes) : top(scopes);
      for (const d of n.declarations) declare(patternNames(d.id), scope);
    },
    VariableDeclarator: (n) => {
      a.bindings.push(...patternIdents(n.id));
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
      if (n.callee.type === "Identifier") a.calls.push(n);
      if (n.callee.type === "Identifier" && n.callee.name === "effect") a.effects.push(span(n));
    },
    CatchClause: (n) => {
      enterScope(n);
      if (n.param) {
        a.bindings.push(...patternIdents(n.param));
        declare(patternNames(n.param), span(n));
      }
    },
    "CatchClause:exit": exitScope,
    ClassDeclaration: (n) => {
      if (!n.id) return;
      a.bindings.push(span(n.id));
      declare([n.id.name], top(scopes));
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
  const isExcluded = coverage(excluded);
  const isBinding = coverage(a.bindings);
  for (const c of candidates) {
    if (seen.has(c.start)) continue;
    seen.add(c.start);
    if (isExcluded(c) || isBinding(c)) continue;
    idents.push({ ...c, shorthand: shorthand.has(c.start) });
  }
  a.idents = idents.sort((x, y) => x.start - y.start);
  for (const r of a.idents) {
    const list = a.identsByName.get(r.name);
    if (list === undefined) a.identsByName.set(r.name, [r]);
    else list.push(r);
  }
  for (const f of a.functions) if (f.name === null) f.name = fnNames.get(f.start) ?? null;
  return a;
}
