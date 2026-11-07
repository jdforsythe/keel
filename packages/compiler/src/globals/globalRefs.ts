import {
  type AssignmentTargetMaybeDefault,
  type AssignmentTargetRest,
  type BindingPattern,
  type Expression,
  type Function as FunctionNode,
  type ParamPattern,
  type Program,
  type PropertyKey,
  Visitor,
} from "oxc-parser";
import type { ResolvedGlobals } from "./ResolvedGlobals.ts";
import { references } from "./references.ts";
import { unwrapExpression as unwrap } from "./unwrapExpression.ts";

type Span = { readonly start: number; readonly end: number };
/** What an assignment, update or `for…in/of` head writes: a name, a member, or a destructuring pattern. */
type Target = AssignmentTargetMaybeDefault | AssignmentTargetRest | Expression;
/** One destructuring step: the property key of a pattern element. */
type Key = { readonly key: PropertyKey; readonly computed: boolean };
/** What a binding was initialized from: `init`, then the destructuring keys in order. */
type Source = { readonly init: Expression; readonly keys: readonly Key[] };
/** `fn`: a function or class declaration, which stands for `Function.prototype` (its `constructor` runs strings). */
type Binding = {
  readonly scope: Span;
  readonly source: Source | null;
  readonly mutable: boolean;
  readonly fn: boolean;
  /** The function a function declaration or named function expression binds (rfc:0061). */
  readonly decl: FunctionNode | null;
};

const GLOBAL_OBJECTS: ReadonlySet<string> = new Set(["globalThis", "window", "self"]);
/** Alias links followed before giving up (a cycle resolves to nothing). */
const MAX_DEPTH = 16;
/** The path a function or class stands for: its `constructor` is the `Function` family (rfc:0058). */
const FUNCTION_PROTOTYPE: readonly string[] = ["Function", "prototype"];

const FUNCTIONS: ReadonlySet<string> = new Set(["FunctionExpression", "ArrowFunctionExpression", "ClassExpression"]);

const spanKey = (start: number, end: number): string => `${start}:${end}`;
const span = (n: Span): Span => ({ start: n.start, end: n.end });

/** Drops leading `globalThis`/`window`/`self` segments (already known to be the globals) while more follow. */
function normalize(p: string[]): string[] {
  let i = 0;
  while (i < p.length - 1 && GLOBAL_OBJECTS.has(p[i] ?? "")) i++;
  return p.slice(i);
}

const memo = new WeakMap<Program, ResolvedGlobals>();

/**
 * Per-file binding table for rfc:0053. Each declared name maps to the lexical scope spans that declare it
 * (program; function for parameters and `var`; block, `for`, `catch`, `switch`, static block for the rest);
 * a read binds to the innermost span containing it, and a name with none is the global. A binding resolves
 * to the path of its initializer (plus destructuring keys) when it is a `const`, a parameter default, or a
 * `let`/`var` never assigned in the file; a function or class resolves to `Function.prototype`, so its
 * `constructor` is `Function` (rfc:0058), and so does `Object.getPrototypeOf`/`Reflect.getPrototypeOf` of one
 * (rfc:0061); any other binding is a local and resolves to null. Keys fold
 * constant strings (`'inner' + 'HTML'`, a template of `const` parts).
 */
export function globalRefs(program: Program): ResolvedGlobals {
  const hit = memo.get(program);
  if (hit !== undefined) return hit;
  const { refs } = references(program);
  const decls = new Map<string, Binding[]>();
  const programScope = span(program);
  const scopes: Span[] = [programScope];
  const fnScopes: Span[] = [programScope];
  const top = (stack: Span[]): Span => stack[stack.length - 1] ?? programScope;
  const exportedDecls = new Set<number>();
  /** Names an `export` declaration binds (`export const D = Date`, `export const { now } = Date`). */
  const exported: { name: string; at: number; destructured: boolean }[] = [];
  const names = (p: BindingPattern, destructured: boolean): void => {
    if (p.type === "Identifier") exported.push({ name: p.name, at: p.start, destructured });
    else if (p.type === "AssignmentPattern") names(p.left, destructured);
    else if (p.type === "ArrayPattern") {
      for (const e of p.elements) if (e !== null) names(e.type === "RestElement" ? e.argument : e, true);
    } else for (const q of p.properties) names(q.type === "RestElement" ? q.argument : q.value, true);
  };
  const assignSpans: Span[] = [];
  /** Simple aliases (`X = <expr>`, no keys) whose initializer is skipped when the alias resolves. */
  const aliases: { name: string; at: number; init: Expression }[] = [];

  const bind = (
    name: string,
    scope: Span,
    source: Source | null,
    mutable: boolean,
    fn = false,
    decl: FunctionNode | null = null,
  ): void => {
    const list = decls.get(name);
    const b: Binding = { scope, source, mutable, fn, decl };
    if (list === undefined) decls.set(name, [b]);
    else list.push(b);
  };
  const pattern = (p: BindingPattern, scope: Span, source: Source | null, mutable: boolean): void => {
    if (p.type === "Identifier") bind(p.name, scope, source, mutable);
    else if (p.type === "AssignmentPattern") pattern(p.left, scope, source, mutable);
    else if (p.type === "ArrayPattern") {
      for (const e of p.elements) {
        if (e === null) continue;
        pattern(e.type === "RestElement" ? e.argument : e, scope, null, mutable);
      }
    } else
      for (const q of p.properties) {
        if (q.type === "RestElement") pattern(q.argument, scope, null, mutable);
        else {
          const next =
            source === null
              ? null
              : { init: source.init, keys: [...source.keys, { key: q.key, computed: q.computed }] };
          pattern(q.value, scope, next, mutable);
        }
      }
  };
  const declare = (
    p: BindingPattern,
    scope: Span,
    init: Expression | null,
    mutable: boolean,
    exported: boolean,
  ): void => {
    pattern(p, scope, init === null ? null : { init, keys: [] }, mutable);
    if (init !== null && p.type === "Identifier" && !exported) aliases.push({ name: p.name, at: p.start, init });
  };
  const params = (ps: readonly ParamPattern[], scope: Span): void => {
    for (const p of ps) {
      if (p.type === "TSParameterProperty") pattern(p.parameter, scope, null, true);
      else if (p.type === "RestElement") pattern(p.argument, scope, null, true);
      else if (p.type === "AssignmentPattern") declare(p.left, scope, p.right, true, false);
      else pattern(p, scope, null, true);
    }
  };
  /** Records the root identifier of each name an assignment target writes. */
  const targets = (t: Target): void => {
    if (t.type === "Identifier") assignSpans.push(span(t));
    else if (t.type === "MemberExpression") targets(t.object);
    else if (t.type === "AssignmentPattern") targets(t.left);
    else if (t.type === "RestElement") targets(t.argument);
    else if (t.type === "ArrayPattern") {
      for (const e of t.elements) if (e !== null) targets(e);
    } else if (t.type === "ObjectPattern")
      for (const q of t.properties) targets(q.type === "RestElement" ? q.argument : q.value);
    else if (
      t.type === "ParenthesizedExpression" ||
      t.type === "TSAsExpression" ||
      t.type === "TSSatisfiesExpression" ||
      t.type === "TSNonNullExpression" ||
      t.type === "TSTypeAssertion"
    )
      targets(t.expression);
  };
  const enter = (n: Span): void => void scopes.push(span(n));
  const exit = (): void => void scopes.pop();
  const fnEnter = (n: Span & { params: readonly ParamPattern[] }): void => {
    const scope = span(n);
    scopes.push(scope);
    fnScopes.push(scope);
    params(n.params, scope);
  };
  const fnExit = (): void => {
    scopes.pop();
    fnScopes.pop();
  };

  new Visitor({
    ImportDeclaration: (n) => {
      for (const s of n.specifiers) bind(s.local.name, programScope, null, false);
    },
    ExportNamedDeclaration: (n) => {
      if (n.declaration !== null) exportedDecls.add(n.declaration.start);
    },
    FunctionDeclaration: (n) => {
      if (n.id) bind(n.id.name, top(scopes), null, false, true, n);
      fnEnter(n);
    },
    "FunctionDeclaration:exit": fnExit,
    FunctionExpression: (n) => {
      if (n.id) bind(n.id.name, span(n), null, false, true, n);
      fnEnter(n);
    },
    "FunctionExpression:exit": fnExit,
    ArrowFunctionExpression: fnEnter,
    "ArrowFunctionExpression:exit": fnExit,
    ClassDeclaration: (n) => {
      if (n.id) bind(n.id.name, top(scopes), null, false, true);
    },
    ClassExpression: (n) => {
      if (n.id) bind(n.id.name, span(n), null, false, true);
    },
    BlockStatement: enter,
    "BlockStatement:exit": exit,
    ForStatement: enter,
    "ForStatement:exit": exit,
    ForInStatement: (n) => {
      enter(n);
      if (n.left.type !== "VariableDeclaration") targets(n.left);
    },
    "ForInStatement:exit": exit,
    ForOfStatement: (n) => {
      enter(n);
      if (n.left.type !== "VariableDeclaration") targets(n.left);
    },
    "ForOfStatement:exit": exit,
    SwitchStatement: enter,
    "SwitchStatement:exit": exit,
    StaticBlock: enter,
    "StaticBlock:exit": exit,
    CatchClause: (n) => {
      enter(n);
      if (n.param) pattern(n.param, span(n), null, true);
    },
    "CatchClause:exit": exit,
    VariableDeclaration: (n) => {
      const scope = n.kind === "var" ? top(fnScopes) : top(scopes);
      const exported = exportedDecls.has(n.start);
      for (const d of n.declarations) {
        declare(d.id, scope, n.declare === true ? null : d.init, n.kind !== "const", exported);
        if (exported) names(d.id, d.id.type !== "Identifier");
      }
    },
    AssignmentExpression: (n) => targets(n.left),
    UpdateExpression: (n) => targets(n.argument),
  }).visit(program);

  /**
   * Names written anywhere in the file, so a `let`/`var` alias of them is not followed. Only a target's root
   * name counts (conservative: `o.x = 1` counts `o`); a name read inside a computed key (`el[k] = x`) or a
   * default value is not written (rfc:0061).
   */
  const assigned = new Set<string>();
  for (const r of refs) if (assignSpans.some((s) => r.start === s.start && r.end === s.end)) assigned.add(r.name);

  const lookup = (name: string, at: number): Binding | undefined => {
    let best: Binding | undefined;
    for (const b of decls.get(name) ?? []) {
      if (at < b.scope.start || at >= b.scope.end) continue;
      if (best === undefined || b.scope.end - b.scope.start < best.scope.end - best.scope.start) best = b;
    }
    return best;
  };
  const followed = (name: string, b: Binding): Source | null =>
    b.source === null || (b.mutable && assigned.has(name)) ? null : b.source;

  const constString = (e: Expression, depth: number): string | null => {
    if (depth > MAX_DEPTH) return null;
    const x = unwrap(e);
    if (x.type === "Literal") return typeof x.value === "string" ? x.value : null;
    if (x.type === "TemplateLiteral") {
      let out = "";
      for (let i = 0; i < x.quasis.length; i++) {
        const cooked = x.quasis[i]?.value.cooked;
        if (cooked === null || cooked === undefined) return null;
        out += cooked;
        const sub = x.expressions[i];
        if (sub === undefined) continue;
        const s = constString(sub, depth + 1);
        if (s === null) return null;
        out += s;
      }
      return out;
    }
    if (x.type === "BinaryExpression" && x.operator === "+") {
      const l = constString(x.left, depth + 1);
      const r = l === null ? null : constString(x.right, depth + 1);
      return l === null || r === null ? null : l + r;
    }
    if (x.type !== "Identifier") return null;
    const b = lookup(x.name, x.start);
    const src = b === undefined ? null : followed(x.name, b);
    return src === null || src.keys.length > 0 ? null : constString(src.init, depth + 1);
  };
  const keyName = (k: Key, depth: number): string | null => {
    if (!k.computed) {
      if (k.key.type === "Identifier") return k.key.name;
      if (k.key.type === "Literal") return typeof k.key.value === "string" ? k.key.value : String(k.key.value);
      return null;
    }
    return k.key.type === "PrivateIdentifier" ? null : constString(k.key, depth);
  };
  const resolveName = (name: string, at: number, depth: number): string[] | null => {
    if (depth > MAX_DEPTH) return null;
    const b = lookup(name, at);
    if (b === undefined) return [name];
    if (b.fn) return [...FUNCTION_PROTOTYPE];
    const src = followed(name, b);
    if (src === null) return null;
    const base = resolveExpr(src.init, depth + 1);
    if (base === null) return null;
    const out = [...base];
    for (const k of src.keys) {
      const key = keyName(k, depth + 1);
      if (key === null) return null;
      out.push(key);
    }
    return normalize(out);
  };
  /** Whether `e` is a function or class value: an expression, a declaration's name, or a same-file alias of one. */
  const isFunctionValue = (e: Expression, depth: number): boolean => {
    const x = unwrap(e);
    if (FUNCTIONS.has(x.type)) return true;
    if (x.type !== "Identifier" || depth > MAX_DEPTH) return false;
    const b = lookup(x.name, x.start);
    if (b === undefined) return false;
    if (b.fn) return true;
    const src = followed(x.name, b);
    return src !== null && src.keys.length === 0 && isFunctionValue(src.init, depth + 1);
  };
  const resolveExpr = (e: Expression, depth: number): string[] | null => {
    const x = unwrap(e);
    if (x.type === "Identifier") return resolveName(x.name, x.start, depth);
    if (FUNCTIONS.has(x.type)) return [...FUNCTION_PROTOTYPE];
    if (x.type === "CallExpression") {
      // rfc:0061: a function's prototype (`Object.getPrototypeOf(async function () {})`) is the `Function` family's.
      const callee = depth > MAX_DEPTH ? null : resolveExpr(x.callee, depth + 1);
      const name = callee === null ? "" : callee.join(".");
      const arg = x.arguments[0];
      if (name !== "Object.getPrototypeOf" && name !== "Reflect.getPrototypeOf") return null;
      return arg !== undefined && arg.type !== "SpreadElement" && isFunctionValue(arg, depth + 1)
        ? [...FUNCTION_PROTOTYPE]
        : null;
    }
    if (x.type !== "MemberExpression") return null;
    const base = resolveExpr(x.object, depth);
    if (base === null) return null;
    const key = x.computed
      ? constString(x.property, depth + 1)
      : x.property.type === "Identifier"
        ? x.property.name
        : null;
    return key === null ? null : normalize([...base, key]);
  };

  /** `e`, or the initializer an unassigned alias chain from `e` ends at (unwrapped), so a value can be inspected. */
  const initOf = (e: Expression, depth: number): Expression => {
    const x = unwrap(e);
    if (x.type !== "Identifier" || depth > MAX_DEPTH) return x;
    const b = lookup(x.name, x.start);
    const src = b === undefined ? null : followed(x.name, b);
    return src === null || src.keys.length > 0 ? x : initOf(src.init, depth + 1);
  };

  const skipped = new Set<string>();
  for (const a of aliases) {
    if (resolveName(a.name, a.at, 0) === null) continue;
    skipped.add(spanKey(a.init.start, a.init.end));
    const inner = unwrap(a.init);
    skipped.add(spanKey(inner.start, inner.end));
  }
  const out: ResolvedGlobals = {
    refs,
    exported,
    resolve: (e) => resolveExpr(e, 0),
    resolveName: (name, at) => resolveName(name, at, 0),
    isAliasInit: (start, end) => skipped.has(spanKey(start, end)),
    constString: (e) => constString(e, 0),
    initOf: (e) => initOf(e, 0),
    functionOf: (name, at) => lookup(name, at)?.decl ?? null,
  };
  memo.set(program, out);
  return out;
}
