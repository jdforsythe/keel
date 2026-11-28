import path from "node:path";
import {
  type ArrowFunctionExpression,
  type BindingPattern,
  type BindingRestElement,
  type Expression,
  type Function as FunctionNode,
  type Program,
  type TSType,
  Visitor,
} from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import { handlerUsesIn } from "./handlerUsesIn.ts";
import { parseFile } from "./parseFile.ts";

/** A binding declared at a module's top level (k.shared At check). */
type TopBinding = {
  readonly kind: "let" | "var" | "const" | "import";
  readonly init: Expression | null;
  readonly annotation: TSType | null;
  readonly source: string | null;
  readonly imported: string | null;
  readonly exported: boolean;
};

const SERVER_FILE = /\.server\.[^/]+$/i;
const KINDS: ReadonlySet<string> = new Set(["let", "var", "const"]);

/** Each name a pattern binds: `{ a, b: [c], ...d }` -> a, c, d. */
function names(p: BindingPattern | BindingRestElement, out: string[]): void {
  if (p.type === "Identifier") out.push(p.name);
  else if (p.type === "ObjectPattern")
    for (const x of p.properties) names(x.type === "RestElement" ? x.argument : x.value, out);
  else if (p.type === "ArrayPattern") {
    for (const x of p.elements) if (x !== null) names(x, out);
  } else names(p.type === "RestElement" ? p.argument : p.left, out);
}

/** The top-level bindings of `program`, by local name: declarations (exported or not) and imports. */
function topBindings(program: Program): ReadonlyMap<string, TopBinding> {
  const out = new Map<string, TopBinding>();
  const exportedNames = new Set<string>();
  for (const st of program.body) {
    if (st.type === "ExportNamedDeclaration" && st.declaration === null && st.source === null)
      for (const sp of st.specifiers) if (sp.local.type === "Identifier") exportedNames.add(sp.local.name);
  }
  for (const st of program.body) {
    if (st.type === "ImportDeclaration") {
      for (const sp of st.specifiers) {
        const imported =
          sp.type === "ImportSpecifier"
            ? sp.imported.type === "Identifier"
              ? sp.imported.name
              : sp.imported.value
            : sp.type === "ImportDefaultSpecifier"
              ? "default"
              : "*";
        out.set(sp.local.name, {
          kind: "import",
          init: null,
          annotation: null,
          source: st.source.value,
          imported,
          exported: exportedNames.has(sp.local.name),
        });
      }
      continue;
    }
    const exported = st.type === "ExportNamedDeclaration";
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl === null || decl.type !== "VariableDeclaration" || !KINDS.has(decl.kind)) continue;
    const kind = decl.kind === "let" ? "let" : decl.kind === "var" ? "var" : "const";
    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier") {
        const bound: string[] = [];
        names(d.id, bound);
        for (const name of bound)
          out.set(name, { kind, init: null, annotation: null, source: null, imported: null, exported });
        continue;
      }
      out.set(d.id.name, {
        kind,
        init: d.init,
        annotation: d.id.typeAnnotation?.typeAnnotation ?? null,
        source: null,
        imported: null,
        exported: exported || exportedNames.has(d.id.name),
      });
    }
  }
  return out;
}

/** The local names under which `program` imports `exported` from `source`. */
function importedAs(program: Program, exported: string, source: string): ReadonlySet<string> {
  const out = new Set<string>();
  for (const [name, b] of topBindings(program)) if (b.source === source && b.imported === exported) out.add(name);
  return out;
}

/** Whether `e` is a call of one of `callees`. */
const callOf = (e: Expression | null, callees: ReadonlySet<string>): boolean => {
  const c = e?.type === "ParenthesizedExpression" ? e.expression : e;
  return c?.type === "CallExpression" && c.callee.type === "Identifier" && callees.has(c.callee.name);
};

/**
 * What k.shared At check reads of one file: whether it is server code (a `*.server.ts` file, or one that calls
 * `loader`, `action` or `guard`), its top-level bindings, whether an offset is inside a function, whether a name is
 * declared by a function enclosing an offset (shadowing the top-level binding), and the module signals (`signal(...)`
 * of `@keel/reactive`, or a binding typed `Signal`) a top-level name is bound to here or, one import away, in a file of
 * the project.
 */
export function moduleState(file: SourceFile, ast: Program, project: readonly SourceFile[]) {
  const server = SERVER_FILE.test(file.path) || handlerUsesIn(file.path, project).length > 0;
  const top = topBindings(ast);
  const scopes: { start: number; end: number; names: Set<string> }[] = [];
  const fn = (n: FunctionNode | ArrowFunctionExpression): void => {
    const own = new Set<string>();
    for (const p of n.params) {
      const out: string[] = [];
      const q = p.type === "TSParameterProperty" ? p.parameter : p;
      if (q.type === "Identifier") out.push(q.name);
      else if (q.type === "RestElement") names(q.argument, out);
      else if (q.type === "AssignmentPattern") names(q.left, out);
      else if (q.type === "ObjectPattern")
        for (const x of q.properties) names(x.type === "RestElement" ? x.argument : x.value, out);
      else for (const x of q.elements) if (x !== null) names(x, out);
      for (const x of out) own.add(x);
    }
    scopes.push({ start: n.start, end: n.end, names: own });
  };
  const declared: { at: number; name: string }[] = [];
  new Visitor({
    FunctionDeclaration: (n) => {
      fn(n);
      if (n.id !== null) declared.push({ at: n.start - 1, name: n.id.name });
    },
    FunctionExpression: fn,
    ArrowFunctionExpression: fn,
    VariableDeclarator: (n) => {
      const out: string[] = [];
      names(n.id, out);
      for (const name of out) declared.push({ at: n.start, name });
    },
    CatchClause: (n) => {
      if (n.param === null) return;
      const out: string[] = [];
      names(n.param, out);
      for (const name of out) declared.push({ at: n.start, name });
    },
  }).visit(ast);
  for (const d of declared) {
    const inner = scopes.filter((s) => d.at > s.start && d.at < s.end).sort((a, b) => b.start - a.start)[0];
    inner?.names.add(d.name);
  }
  const inFunction = (at: number): boolean => scopes.some((s) => at > s.start && at < s.end);
  const shadowed = (name: string, at: number): boolean =>
    scopes.some((s) => at > s.start && at < s.end && s.names.has(name));

  /** Whether `b`, a top-level binding of `program`, is a signal made by `@keel/reactive`'s `signal`, or typed `Signal`. */
  const isSignal = (b: TopBinding, program: Program): boolean => {
    const t = b.annotation;
    if (t?.type === "TSTypeReference" && t.typeName.type === "Identifier") {
      const typed = importedAs(program, "Signal", "@keel/reactive");
      if (typed.has(t.typeName.name)) return true;
    }
    return callOf(b.init, importedAs(program, "signal", "@keel/reactive"));
  };
  /** The project file a relative specifier names, read as written or with a code extension. */
  const fileOf = (spec: string): SourceFile | undefined => {
    if (!spec.startsWith(".")) return undefined;
    const base = path.posix.normalize(path.posix.join(path.posix.dirname(file.path), spec));
    const tries = [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`];
    return tries.map((p) => project.find((f) => f.path === p)).find((f) => f !== undefined);
  };
  /** Whether the top-level name `name` is bound to a module signal, here or in the file it is imported from. */
  const moduleSignal = (name: string): boolean => {
    const b = top.get(name);
    if (b === undefined) return false;
    if (b.kind !== "import") return b.kind === "const" && isSignal(b, ast);
    if (b.source === null || b.imported === null) return false;
    const from = fileOf(b.source);
    const parsed = from === undefined ? undefined : parseFile(from);
    if (parsed === undefined || !parsed.ok) return false;
    const there = topBindings(parsed.program).get(b.imported);
    return there?.exported === true && there.kind === "const" && isSignal(there, parsed.program);
  };
  return { server, top, inFunction, shadowed, moduleSignal };
}
