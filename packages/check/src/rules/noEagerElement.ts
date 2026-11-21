import { type ResolvedGlobals, globalRefs, unwrapExpression } from "@keel/compiler/internal";
import {
  type ArrowFunctionExpression,
  type Expression,
  type Function as FunctionNode,
  type Program,
  Visitor,
} from "oxc-parser";
import { BASE_ELEMENTS } from "../internal/BASE_ELEMENTS.ts";
import { findingAt } from "../internal/findingAt.ts";
import { importTarget } from "../internal/importTarget.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { lineCol } from "../internal/lineCol.ts";
import { num } from "../internal/num.ts";
import { parseFile } from "../internal/parseFile.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import { noEagerChild } from "./noEagerChild.ts";

/** The components each Keel package exports by name; a `@keel/std-*` export is one when its name is capitalized. */
const KEEL: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["@keel/ui", BASE_ELEMENTS],
  ["@keel/ui/aria", new Set(["Part"])],
  ["@keel/router", new Set(["Form"])],
  // `Case` is a description `Match` reads, never placed.
  ["@keel/runtime-dom", new Set(["For", "If", "Match", "Boundary"])],
]);
/** Calls whose callback's return value becomes the elements of an array. */
const MAPS: ReadonlySet<string> = new Set(["map", "flatMap"]);
/** Links (aliases, calls, imports) followed before giving up. */
const MAX_DEPTH = 12;

type Fn = FunctionNode | ArrowFunctionExpression;
type Imported = { readonly local: string; readonly at: number; readonly source: string; readonly name: string };
/** One file as the rule reads it: its AST, binding table and value imports (`name` "*" a namespace, "default"). */
type FileOf = {
  readonly path: string;
  readonly ast: Program;
  readonly g: ResolvedGlobals;
  readonly imports: readonly Imported[];
  readonly returns: readonly { readonly owner: number; readonly argument: Expression | null }[];
};

const isFn = (n: Expression | Fn): n is Fn =>
  n.type === "FunctionDeclaration" || n.type === "FunctionExpression" || n.type === "ArrowFunctionExpression";
const files = new WeakMap<Program, FileOf>();

function fileOf(path: string, ast: Program): FileOf {
  const hit = files.get(ast);
  if (hit !== undefined) return hit;
  const imports: Imported[] = [];
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportSpecifier" && sp.importKind === "type") continue;
      const name =
        sp.type === "ImportNamespaceSpecifier"
          ? "*"
          : sp.type === "ImportDefaultSpecifier"
            ? "default"
            : sp.imported.type === "Identifier"
              ? sp.imported.name
              : sp.imported.value;
      imports.push({ local: sp.local.name, at: sp.local.start, source: st.source.value, name });
    }
  }
  // Each return with the innermost function holding it.
  const fns: { start: number; end: number }[] = [];
  const rets: { start: number; argument: Expression | null }[] = [];
  const fn = (n: { start: number; end: number }) => void fns.push({ start: n.start, end: n.end });
  new Visitor({
    FunctionDeclaration: fn,
    FunctionExpression: fn,
    ArrowFunctionExpression: fn,
    ReturnStatement: (r) => void rets.push({ start: r.start, argument: r.argument }),
  }).visit(ast);
  const returns = rets.map((r) => {
    let owner = -1;
    for (const f of fns) if (f.start <= r.start && r.start < f.end && f.start > owner) owner = f.start;
    return { owner, argument: r.argument };
  });
  const out = { path, ast, g: globalRefs(ast), imports, returns };
  files.set(ast, out);
  return out;
}

/** What a function returns: its expression body, or its own `return` arguments. */
function returnsOf(f: FileOf, fn: Fn): Expression[] {
  if (fn.type === "ArrowFunctionExpression" && fn.body.type !== "BlockStatement") return [fn.body];
  return f.returns.flatMap((r) => (r.owner === fn.start && r.argument !== null ? [r.argument] : []));
}

/**
 * E1258 (k.claim Check): a value given to a component as `children` or any other prop that holds an element made
 * before the call, unless E1808 reports it. A component is a base element, `Part`, an intrinsic, `Form`, a std
 * widget, or a function the project's files resolve whose body returns JSX or a component call. Made before the
 * call: JSX or a component call outside a thunk, an array holding one, `xs.map(f)` with `f` returning one, a branch
 * of `?:`, `&&`, `||` or `??`, and a binding whose initializer is one of these (same file, or a `const` imported
 * from a project file), also when a thunk given as the prop returns it, alone or in an array, and it is declared
 * outside that thunk; a JSX attribute holding such a binding counts. Fix: `() => ` before an inline value; none for a
 * binding.
 */
export const noEagerElement: RuleDef = {
  code: "E1258",
  message: (f) => `${str(f.data, "prop")}: an element made before the call; make it inside a thunk: () => ...`,
  see: "k.claim",
  check: ({ file, ast, artifacts, project }) => {
    if (!isAppPath(file.path)) return [];
    const here = fileOf(file.path, ast);
    // One diagnostic per fault: where E1808 reports a base element's children, E1258 does not.
    const e1808 = new Set(noEagerChild.check({ file, ast, artifacts, project }).map((d) => `${d.line}:${d.col}`));
    const reader = makeReader(project);
    const out: Finding[] = [];
    const report = (at: number, prop: string, fix: boolean): void => {
      const { line, col } = lineCol(file.source, at);
      if (e1808.has(`${line}:${col}`)) return;
      out.push(findingAt(file, at, { prop, at: fix ? at : -1 }));
    };
    new Visitor({
      CallExpression: (n) => {
        if (!reader.component(here, n.callee, 0)) return;
        const first = n.arguments[0];
        const arg = first === undefined || first.type === "SpreadElement" ? null : here.g.initOf(first);
        if (arg === null || arg.type !== "ObjectExpression") return;
        for (const p of arg.properties) {
          if (p.type !== "Property") continue;
          const prop = keyName(p) ?? "prop";
          const v = unwrapExpression(p.value);
          if (isFn(v)) {
            if (reader.thunkHolds(here, v, 0)) report(p.value.start, prop, false);
          } else if (reader.eager(here, v, 0)) report(p.value.start, prop, !p.shorthand && v.type !== "Identifier");
        }
      },
      JSXElement: (n) => {
        const name = n.openingElement.name;
        if (name.type !== "JSXIdentifier" || !/^[A-Z]/.test(name.name)) return;
        if (!reader.named(here, name.name, name.start, 0)) return;
        for (const a of n.openingElement.attributes) {
          if (a.type !== "JSXAttribute" || a.value === null || a.value.type !== "JSXExpressionContainer") continue;
          const e = a.value.expression;
          if (e.type === "JSXEmptyExpression") continue;
          const prop = a.name.type === "JSXIdentifier" ? a.name.name : "prop";
          if (reader.holdsBinding(here, e, 0)) report(a.value.start, prop, false);
        }
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const at = num(f.data, "at", -1);
    return at < 0 ? null : [{ start: at, end: at, text: "() => " }];
  },
};

/** The project-aware predicates of E1258, reading other project files through `project`. */
function makeReader(project: readonly SourceFile[]) {
  /** The file a relative import of `f` names, read. */
  const target = (f: FileOf, source: string): FileOf | null => {
    const t = importTarget(f.path, source, project);
    const parsed = t === undefined ? undefined : parseFile(t);
    return t === undefined || parsed === undefined || !parsed.ok ? null : fileOf(t.path, parsed.program);
  };
  /** The value a module exports as `name`: a function or a `const` initializer. */
  const exported = (f: FileOf, name: string): Fn | Expression | null => {
    for (const st of f.ast.body) {
      if (name === "default" && st.type === "ExportDefaultDeclaration") {
        const d = st.declaration;
        return d.type === "FunctionDeclaration"
          ? d
          : d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration"
            ? null
            : unwrapExpression(d);
      }
      if (st.type !== "ExportNamedDeclaration" || st.declaration === null || st.declaration === undefined) continue;
      const d = st.declaration;
      if (d.type === "FunctionDeclaration" && d.id?.name === name) return d;
      if (d.type !== "VariableDeclaration") continue;
      for (const v of d.declarations)
        if (v.id.type === "Identifier" && v.id.name === name && v.init !== null && v.init !== undefined)
          return d.kind === "const" ? unwrapExpression(v.init) : null;
    }
    return null;
  };
  /** The import `local` (read at `at`) of `f`, if it is one. */
  const importOf = (f: FileOf, local: string, at: number): Imported | undefined =>
    f.imports.find((i) => i.local === local && f.g.sameBinding(local, at, i.at));
  /** What an imported project name is: its file and exported value. */
  const far = (f: FileOf, imp: Imported): { readonly file: FileOf; readonly value: Fn | Expression } | null => {
    if (imp.name === "*") return null;
    const t = target(f, imp.source);
    const value = t === null ? null : exported(t, imp.name);
    return t === null || value === null ? null : { file: t, value };
  };

  const r = {
    /** Whether the name `local`, read at `at` in `f`, is a component. */
    named(f: FileOf, local: string, at: number, depth: number): boolean {
      if (depth > MAX_DEPTH) return false;
      const imp = importOf(f, local, at);
      if (imp !== undefined) {
        const keel = KEEL.get(imp.source);
        if (keel !== undefined) return keel.has(imp.name);
        if (imp.source.startsWith("@keel/std-")) return /^[A-Z]/.test(imp.name);
        const x = far(f, imp);
        return x !== null && isFn(x.value) && r.returnsElement(x.file, x.value, depth + 1);
      }
      const decl = f.g.functionOf(local, at);
      return decl !== null && r.returnsElement(f, decl, depth + 1);
    },
    /** Whether a callee denotes a component (an IIFE is not followed). */
    component(f: FileOf, callee: Expression, depth: number): boolean {
      if (isFn(unwrapExpression(callee))) return false;
      const x = f.g.initOf(callee);
      if (x.type === "Identifier") return r.named(f, x.name, x.start, depth);
      if (isFn(x)) return r.returnsElement(f, x, depth + 1);
      if (x.type !== "MemberExpression" || x.computed || x.object.type !== "Identifier") return false;
      const imp = importOf(f, x.object.name, x.object.start);
      if (imp === undefined || imp.name !== "*") return false;
      const key = x.property.name;
      return KEEL.get(imp.source)?.has(key) ?? (imp.source.startsWith("@keel/std-") && /^[A-Z]/.test(key));
    },
    /** Whether a function returns JSX or a component call (an element made at the call). */
    returnsElement(f: FileOf, fn: Fn, depth: number): boolean {
      return depth <= MAX_DEPTH && returnsOf(f, fn).some((e) => r.eager(f, e, depth + 1));
    },
    /** Whether `e` holds an element made when it is evaluated. */
    eager(f: FileOf, e: Expression, depth: number): boolean {
      if (depth > MAX_DEPTH) return false;
      const x = unwrapExpression(e);
      switch (x.type) {
        case "JSXElement":
        case "JSXFragment":
          return true;
        case "CallExpression": {
          if (r.component(f, x.callee, depth + 1)) return true;
          const c = unwrapExpression(x.callee);
          if (c.type !== "MemberExpression" || c.computed || !MAPS.has(c.property.name)) return false;
          const cb = x.arguments[0];
          if (cb === undefined || cb.type === "SpreadElement") return false;
          return r.callbackEager(f, cb, depth + 1);
        }
        case "ArrayExpression":
          return x.elements.some((el) => el !== null && el.type !== "SpreadElement" && r.eager(f, el, depth + 1));
        case "ConditionalExpression":
          return r.eager(f, x.consequent, depth + 1) || r.eager(f, x.alternate, depth + 1);
        case "LogicalExpression":
          return r.eager(f, x.left, depth + 1) || r.eager(f, x.right, depth + 1);
        case "Identifier": {
          const init = f.g.initOf(x);
          if (init !== x) return !isFn(init) && r.eager(f, init, depth + 1);
          const imp = importOf(f, x.name, x.start);
          const y = imp === undefined ? null : far(f, imp);
          return y !== null && !isFn(y.value) && r.eager(y.file, y.value, depth + 1);
        }
        default:
          return false;
      }
    },
    /** Whether a `map` callback returns an element: a function, or a name of one. */
    callbackEager(f: FileOf, cb: Expression, depth: number): boolean {
      const x = f.g.initOf(cb);
      if (isFn(x)) return r.returnsElement(f, x, depth);
      if (x.type !== "Identifier") return false;
      const decl = f.g.functionOf(x.name, x.start);
      if (decl !== null) return r.returnsElement(f, decl, depth);
      const imp = importOf(f, x.name, x.start);
      const y = imp === undefined ? null : far(f, imp);
      return y !== null && isFn(y.value) && r.returnsElement(y.file, y.value, depth);
    },
    /** Whether a thunk returns, alone or in an array, a binding declared outside it that holds an eager element. */
    thunkHolds(f: FileOf, fn: Fn, depth: number): boolean {
      const outside = (e: Expression): boolean => {
        const x = unwrapExpression(e);
        if (x.type === "ArrayExpression")
          return x.elements.some((el) => el !== null && el.type !== "SpreadElement" && outside(el));
        if (x.type !== "Identifier") return false;
        const init = f.g.initOf(x);
        if (init !== x && init.start >= fn.start && init.end <= fn.end) return false;
        return r.eager(f, x, depth + 1);
      };
      return returnsOf(f, fn).some(outside);
    },
    /** Whether a JSX attribute value holds an eager binding (alone, in an array or a branch). */
    holdsBinding(f: FileOf, e: Expression, depth: number): boolean {
      const x = unwrapExpression(e);
      switch (x.type) {
        case "Identifier":
          return r.eager(f, x, depth + 1);
        case "ArrayExpression":
          return x.elements.some(
            (el) => el !== null && el.type !== "SpreadElement" && r.holdsBinding(f, el, depth + 1),
          );
        case "ConditionalExpression":
          return r.holdsBinding(f, x.consequent, depth + 1) || r.holdsBinding(f, x.alternate, depth + 1);
        case "LogicalExpression":
          return r.holdsBinding(f, x.left, depth + 1) || r.holdsBinding(f, x.right, depth + 1);
        default:
          return false;
      }
    },
  };
  return r;
}
