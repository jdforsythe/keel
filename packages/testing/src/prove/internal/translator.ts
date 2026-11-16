import type {
  ArrowFunctionExpression,
  BinaryExpression,
  CallExpression,
  Directive,
  Expression,
  Function as FunctionNode,
  ObjectExpression,
  PrivateInExpression,
  Statement,
} from "oxc-parser";
import { Outside } from "./Outside.ts";
import type { Ty } from "./Ty.ts";
import type { V } from "./V.ts";
import { num } from "./num.ts";
import type { sortTable } from "./sortTable.ts";

type Sorts = ReturnType<typeof sortTable>;
type Val = Extract<V, { v: "val" }>;
type Env = ReadonlyMap<string, V>;
type Span = { readonly start: number; readonly type: string };
const NIL: V = { v: "nil", nul: false };
const BOOL: Ty = { k: "bool" };
const INT: Ty = { k: "int" };
const val = (t: Ty, e: string, n?: string): Val => (n === undefined ? { v: "val", t, e } : { v: "val", t, e, n });
const privateIn = (n: BinaryExpression | PrivateInExpression): n is PrivateInExpression =>
  n.left.type === "PrivateIdentifier";
const sel = (s: string, a: string, i: string): string => `(select (${s}.a ${a}) ${i})`;
const range = (i: string, n: string): string => `(<= 0 ${i}) (< ${i} ${n})`;
const ARRAY_METHODS = ["map", "some", "every", "find"];
/** An object, array or map, or an option of one: `===` compares references, which the terms do not hold. */
const isRef = (t: Ty): boolean => t.k === "obj" || t.k === "arr" || t.k === "rec" || (t.k === "opt" && isRef(t.v));
/** The name a call's callee is known by: `f`, `Math.max`; a bundler's import namespace is left out. */
const calleeName = (e: Expression): string => {
  if (e.type === "Identifier") return e.name;
  if (e.type === "ParenthesizedExpression") return calleeName(e.expression);
  const last = e.type === "SequenceExpression" ? e.expressions[e.expressions.length - 1] : undefined;
  if (last !== undefined) return calleeName(last);
  if (e.type !== "MemberExpression" || e.computed || e.property.type !== "Identifier") return e.type;
  const o = e.object;
  return o.type === "Identifier" && o.name.startsWith("__vite_ssr_")
    ? e.property.name
    : `${calleeName(o)}.${e.property.name}`;
};

/**
 * Translate functions of the fragment (k.prove Fragment) into SMT terms over `sorts`. `base` is the offset of the
 * function in the parsed text, so E1715 offsets count in the function's own source. `axioms` collects what a `.find`
 * declares and asserts; `fresh` numbers bound names across the translators of one obligation; `need` collects what
 * the functions require to run as their terms say (an option present, an index in range, an exact integer, a key the
 * schema allows), each under the branch conditions and bound indices where it arises: the goal holds them too.
 */
export function translator(sorts: Sorts, base: number, axioms: string[], fresh: { n: number }, need: string[]) {
  /** The indices bound around the code at hand, each an `Int`. */
  const bound: string[] = [];
  const all = (body: string): string =>
    bound.length === 0 ? body : `(forall (${bound.map((v) => `(${v} Int)`).join("")}) ${body})`;
  const path: string[] = [];
  const out = (node: Span, construct = node.type): never => {
    throw new Outside(construct, node.start - base);
  };
  const name = (prefix: string): string => `${prefix}${fresh.n++}`;
  const smt = sorts.smt;
  const must = (v: V, node: Span): Val => (v.v === "val" ? v : out(node));
  const lenOf = (a: Val): string => a.n ?? `(${smt(a.t)}.n ${a.e})`;
  const real = (v: Val): string => (v.t.k === "int" ? `(to_real ${v.e})` : v.e);
  const isNum = (v: Val): boolean => v.t.k === "int" || v.t.k === "real";
  /** `c` must hold wherever the code at hand runs: under the enclosing branch conditions, for every bound index. */
  const oblige = (c: string): number => need.push(all(`(=> (and true ${path.join(" ")}) ${c})`));
  /** `f` under the condition `c`, and for each index `i` when given. */
  const scoped = <R>(f: () => R, c: string, i?: string): R => {
    path.push(c);
    if (i !== undefined) bound.push(i);
    try {
      return f();
    } finally {
      path.pop();
      if (i !== undefined) bound.pop();
    }
  };
  /** `e` of `t` when `c` holds, else `undefined`. */
  const maybe = (c: string, t: Ty, e: string): Val => {
    const o = smt(sorts.opt(t, false));
    return val(sorts.opt(t, false), `(ite ${c} (${o}.some ${e}) ${o}.none)`);
  };
  /** The value inside an option, which must be present (`x === undefined ? ... : x.f`). */
  const some = (v: Val): Val => {
    if (v.t.k !== "opt") return v;
    oblige(`((_ is ${v.t.s}.some) ${v.e})`);
    return some(val(v.t.v, `(${v.t.s}.v ${v.e})`));
  };

  const coerce = (v: V, t: Ty, node: Span): string => {
    if (v.v === "set") return out(node, "a Set as a value");
    if (v.v === "nil") {
      if (t.k !== "opt") return out(node, "undefined or null");
      return t.nul === v.nul ? `${t.s}.none` : `(${t.s}.some ${coerce(v, t.v, node)})`;
    }
    // A container's sort names the length rules inside it (`sortTable`); a string needs the rule of where it goes.
    if (smt(v.t) === smt(t))
      return t.k !== "str" || t.ok === undefined || (v.t.k === "str" && v.t.ok === t.ok)
        ? v.e
        : out(node, "a string rule");
    if (t.k === "opt") return `(${t.s}.some ${coerce(v, t.v, node)})`;
    if (v.t.k === "opt") return coerce(some(v), t, node);
    return t.k === "real" && v.t.k === "int" ? `(to_real ${v.e})` : out(node, `a ${v.t.k} for a ${t.k}`);
  };

  const eq = (a: V, b: V, node: Span): string => {
    if (a.v === "set" || b.v === "set") return out(node);
    if (a.v === "nil") return b.v === "nil" ? String(a.nul === b.nul) : eq(b, a, node);
    if (b.v === "nil") {
      if (a.t.k !== "opt") return "false";
      if (a.t.nul === b.nul) return `((_ is ${a.t.s}.none) ${a.e})`;
      return `(and ((_ is ${a.t.s}.some) ${a.e}) ${eq(val(a.t.v, `(${a.t.s}.v ${a.e})`), b, node)})`;
    }
    if (isRef(a.t) || isRef(b.t)) return out(node, "=== on objects");
    if (smt(a.t) === smt(b.t)) return `(= ${a.e} ${b.e})`;
    if (a.t.k === "opt") return `(and ((_ is ${a.t.s}.some) ${a.e}) ${eq(val(a.t.v, `(${a.t.s}.v ${a.e})`), b, node)})`;
    if (b.t.k === "opt") return eq(b, a, node);
    return isNum(a) && isNum(b) ? `(= ${real(a)} ${real(b)})` : out(node);
  };

  const typed = (node: Expression, env: Env, k: "bool" | "num"): Val => {
    const v = some(must(expr(node, env), node));
    return (k === "bool" ? v.t.k === "bool" : isNum(v)) ? v : out(node);
  };
  const bool = (node: Expression, env: Env): string => typed(node, env, "bool").e;

  /** `c ? a : b` with both sides in `exp`, or in the type of the side that has one; each under its condition. */
  const join = (c: string, fa: () => V, fb: () => V, exp: Ty | undefined, node: Span): V => {
    const n = `(not ${c})`;
    const a = scoped(fa, c);
    const b = scoped(fb, n);
    const t = exp ?? (a.v === "val" ? a.t : b.v === "val" ? b.t : out(node));
    return val(t, `(ite ${c} ${scoped(() => coerce(a, t, node), c)} ${scoped(() => coerce(b, t, node), n)})`);
  };

  /** A function of the fragment applied to `args`: its body as a term, in `exp` when given. */
  const apply = (f: ArrowFunctionExpression | FunctionNode, args: readonly V[], env: Env, exp: Ty | undefined): V => {
    if (f.async || f.generator || f.body === null) return out(f);
    const inner = new Map(env);
    for (const [i, p] of f.params.entries()) {
      if (p.type !== "Identifier") return out(p);
      inner.set(p.name, args[i] ?? NIL);
    }
    return f.body.type === "BlockStatement" ? block(f.body.body, inner, exp) : expr(f.body, inner, exp);
  };

  /** One block's statements in `env`; `k` continues after the block, in the enclosing scope. */
  const block = (stmts: readonly (Directive | Statement)[], env: Env, exp: Ty | undefined, k = (): V => NIL): V => {
    const [st, ...rest] = stmts;
    if (st === undefined) return k();
    const next = (): V => block(rest, env, exp, k);
    switch (st.type) {
      case "ReturnStatement":
        return st.argument === null ? NIL : expr(st.argument, env, exp);
      case "VariableDeclaration": {
        if (st.kind !== "const") return out(st, `a ${st.kind} binding`);
        const next = new Map(env);
        for (const d of st.declarations) {
          // A name bound already would be shadowed, and read before its declaration (in TDZ) here.
          if (d.id.type !== "Identifier" || d.init === null || next.has(d.id.name)) return out(d);
          next.set(d.id.name, expr(d.init, next));
        }
        return block(rest, next, exp, k);
      }
      case "IfStatement": {
        const list = (s: Statement | null): readonly Statement[] =>
          s === null ? [] : s.type === "BlockStatement" ? s.body : [s];
        const arm = (s: Statement | null) => (): V => block(list(s), env, exp, next);
        return join(bool(st.test, env), arm(st.consequent), arm(st.alternate), exp, st);
      }
      case "BlockStatement":
        return block(st.body, env, exp, next);
      case "ExpressionStatement":
        return "directive" in st && typeof st.directive === "string" ? next() : out(st.expression);
      default:
        return out(st);
    }
  };

  const call = (node: CallExpression, env: Env, exp: Ty | undefined): V => {
    const ce = node.callee;
    const named = (): never => out(node, `call to ${calleeName(ce)}`);
    if (node.optional || ce.type !== "MemberExpression" || ce.computed || ce.property.type !== "Identifier")
      return named();
    const method = ce.property.name;
    const [arg, more] = node.arguments;
    if (
      (ce.object.type === "Identifier" && !env.has(ce.object.name)) ||
      arg === undefined ||
      more !== undefined ||
      arg.type === "SpreadElement"
    )
      return named();
    const recv = expr(ce.object, env);
    if (recv.v === "set") {
      if (method !== "has") return named();
      const a = recv.a;
      const i = name("i");
      const at = val(a.t.k === "arr" ? a.t.v : a.t, sel(smt(a.t), a.e, i));
      return val(BOOL, `(exists ((${i} Int)) (and ${range(i, lenOf(a))} ${eq(at, expr(arg, env), node)}))`);
    }
    const r = must(recv, ce.object);
    if (r.t.k !== "arr" || !ARRAY_METHODS.includes(method)) return named();
    if (arg.type !== "ArrowFunctionExpression" || arg.params.length !== 1) return out(arg);
    const item = r.t.v;
    const S = r.t.s;
    const len = lenOf(r);
    /** The callback at index `i`, run under `0 <= i < length`. */
    const body = <R>(i: string, f: (v: V) => R, want?: Ty): R =>
      scoped(() => f(apply(arg, [val(item, sel(S, r.e, i))], env, want)), `(and ${range(i, len)})`, i);
    const test = (i: string): string =>
      body(i, (b) => {
        const v = must(b, arg);
        return v.t.k === "bool" ? v.e : out(arg);
      });
    const i = name("i");
    if (method === "some") return val(BOOL, `(exists ((${i} Int)) (and ${range(i, len)} ${test(i)}))`);
    if (method === "every") return val(BOOL, `(forall ((${i} Int)) (=> (and ${range(i, len)}) ${test(i)}))`);
    if (method === "map") {
      const want = exp?.k === "arr" ? exp.v : exp?.k === "opt" && exp.v.k === "arr" ? exp.v.v : undefined;
      const m = body(
        i,
        (b) => {
          const t = want ?? must(b, arg).t;
          return { t, e: coerce(b, t, arg) };
        },
        want,
      );
      const a = sorts.coll("arr", m.t);
      return val(a, `(${smt(a)} ${len} (lambda ((${i} Int)) ${m.e}))`, len);
    }
    // find: the first index where the callback holds, a function of the enclosing bound indices
    const k = name("F");
    const app = bound.length === 0 ? k : `(${k} ${bound.join(" ")})`;
    const j = name("i");
    const t = test(i);
    const at = (x: string): string => `(let ((${i} ${x})) ${t})`;
    const ex = `(exists ((${i} Int)) (and ${range(i, len)} ${t}))`;
    const ax = `(=> ${ex} (and ${range(app, len)} ${at(app)} (forall ((${j} Int)) (=> (and ${range(j, app)}) (not ${at(j)})))))`;
    axioms.push(`(declare-fun ${k} (${bound.map(() => "Int").join(" ")}) Int)(assert ${all(ax)})`);
    return maybe(ex, item, sel(S, r.e, app));
  };

  const binary = (node: BinaryExpression | PrivateInExpression, env: Env): V => {
    if (privateIn(node)) return out(node);
    const { operator: op, left, right } = node;
    if (op === "===" || op === "!==") {
      const pos = (e: string): V => val(BOOL, op === "===" ? e : `(not ${e})`);
      const size = (e: Expression): Expression | undefined =>
        e.type === "MemberExpression" && !e.computed && e.property.type === "Identifier" && e.property.name === "size"
          ? e.object
          : undefined;
      const lhs = size(left);
      const of = lhs ?? size(right);
      const set = of === undefined ? undefined : expr(of, env);
      if (set?.v !== "set") return pos(eq(expr(left, env), expr(right, env), node));
      const len = lenOf(set.a);
      if (must(expr(lhs === undefined ? left : right, env), node).e !== len) return out(node, "Set.size");
      const [x, y, S] = [name("i"), name("i"), smt(set.a.t)];
      return pos(
        `(forall ((${x} Int) (${y} Int)) (=> (and (<= 0 ${x}) (< ${x} ${y} ${len})) (not (= ${sel(S, set.a.e, x)} ${sel(S, set.a.e, y)}))))`,
      );
    }
    const a = typed(left, env, "num");
    const b = typed(right, env, "num");
    if (op === "<" || op === "<=" || op === ">" || op === ">=")
      return val(BOOL, a.t.k === b.t.k ? `(${op} ${a.e} ${b.e})` : `(${op} ${real(a)} ${real(b)})`);
    const lit = (e: Expression): boolean =>
      e.type === "Literal" || (e.type === "UnaryExpression" && e.argument.type === "Literal");
    if (
      (op !== "+" && op !== "-" && op !== "*") ||
      a.t.k !== "int" ||
      b.t.k !== "int" ||
      (op === "*" && !lit(left) && !lit(right))
    )
      return out(node, `${op} here`);
    // JavaScript holds an integer exactly within ±2^53, so every `+`, `-` and `*` result must stay there.
    const r = `(${op} ${a.e} ${b.e})`;
    oblige(`(<= (- 9007199254740992) ${r} 9007199254740992)`);
    return val(INT, r);
  };

  const object = (node: ObjectExpression, env: Env, exp: Ty | undefined): V => {
    const t = exp?.k === "opt" ? exp.v : exp;
    if (t === undefined || (t.k !== "obj" && t.k !== "rec")) return out(node);
    const S = t.s;
    const vals = new Map<string, V>();
    let acc = `(${S} ((as const (Array Str Bool)) false) ((as const (Array Str ${t.k === "rec" ? smt(t.v) : "Bool"})) ${S}.d))`;
    for (const [i, p] of node.properties.entries()) {
      if (p.type === "SpreadElement") {
        const src = must(expr(p.argument, env, t), p);
        if (t.k === "rec" && i === 0) acc = coerce(src, t, p);
        else if (src.t.k === "obj" && t.k === "obj")
          for (const [n, [k, ft]] of src.t.f.entries()) vals.set(k, val(ft, `(${src.t.s}.${n} ${src.e})`));
        else return out(p);
        continue;
      }
      if (p.kind !== "init" || p.method || (p.computed && t.k === "obj")) return out(p);
      const key = p.key;
      const plain = key.type === "Identifier" ? key.name : key.type === "Literal" ? String(key.value) : undefined;
      if (t.k === "obj") {
        vals.set(plain ?? out(p), expr(p.value, env, t.f.find(([k]) => k === plain)?.[1]));
        continue;
      }
      const k =
        p.computed && key.type !== "PrivateIdentifier"
          ? coerce(expr(key, env), { k: "str" }, p)
          : sorts.lit(plain ?? out(p));
      const r = name("r");
      // An own key the schema refuses (`__proto__`, `constructor`, `prototype`) breaks the map.
      oblige(`(distinct ${k} ${["__proto__", "constructor", "prototype"].map(sorts.lit).join(" ")})`);
      acc = `(let ((${r} ${acc})) (${S} (store (${S}.n ${r}) ${k} true) (store (${S}.a ${r}) ${k} ${coerce(expr(p.value, env, t.v), t.v, p)})))`;
    }
    if (t.k !== "obj") return val(t, acc);
    for (const k of vals.keys()) if (!t.f.some(([f]) => f === k)) out(node, `.${k}`);
    const fields = t.f.map(([k, ft]) =>
      coerce(vals.get(k) ?? (ft.k === "opt" && !ft.nul ? NIL : out(node, `no ${k}`)), ft, node),
    );
    return val(t, fields.length === 0 ? S : `(${S} ${fields.join(" ")})`);
  };

  const expr = (node: Expression, env: Env, exp?: Ty): V => {
    switch (node.type) {
      case "ParenthesizedExpression":
        return expr(node.expression, env, exp);
      case "Literal": {
        const x = node.value;
        if (typeof x === "boolean") return val(BOOL, String(x));
        if (typeof x === "number") return val({ k: Number.isInteger(x) ? "int" : "real" }, num(x));
        if (typeof x === "string") return val({ k: "str", one: [x] }, sorts.lit(x));
        return x === null ? { v: "nil", nul: true } : out(node);
      }
      case "Identifier":
        return env.get(node.name) ?? (node.name === "undefined" ? NIL : out(node, `the identifier ${node.name}`));
      case "MemberExpression": {
        if (node.optional || node.property.type === "PrivateIdentifier") return out(node);
        const o = some(must(expr(node.object, env), node.object));
        if (node.computed) {
          // Undefined past the length, or for a key the map lacks; a key Object.prototype holds is no value.
          if (o.t.k !== "arr" && o.t.k !== "rec") return out(node);
          const arr = o.t.k === "arr";
          const k = coerce(expr(node.property, env), arr ? INT : { k: "str" }, node);
          const has = arr ? `(and ${range(k, lenOf(o))})` : `(select (${o.t.s}.n ${o.e}) ${k})`;
          if (!arr)
            oblige(
              `(or ${has} (distinct ${k} ${Object.getOwnPropertyNames(Object.prototype).map(sorts.lit).join(" ")}))`,
            );
          return maybe(has, o.t.v, sel(o.t.s, o.e, k));
        }
        const prop = node.property.name;
        if (prop === "length" && o.t.k === "arr") return val(INT, lenOf(o));
        const i = o.t.k === "obj" ? o.t.f.findIndex(([k]) => k === prop) : -1;
        const ft = o.t.k === "obj" ? o.t.f[i]?.[1] : undefined;
        return ft === undefined ? out(node, `.${prop}`) : val(ft, `(${smt(o.t)}.${i} ${o.e})`);
      }
      case "CallExpression":
        return call(node, env, exp);
      case "NewExpression": {
        const [a, more] = node.arguments;
        if (
          node.callee.type !== "Identifier" ||
          node.callee.name !== "Set" ||
          a === undefined ||
          more !== undefined ||
          a.type === "SpreadElement"
        )
          return out(node, `new ${calleeName(node.callee)}`);
        const arr = must(expr(a, env), a);
        return arr.t.k === "arr" ? { v: "set", a: arr } : out(a);
      }
      case "ConditionalExpression":
        return join(
          bool(node.test, env),
          () => expr(node.consequent, env, exp),
          () => expr(node.alternate, env, exp),
          exp,
          node,
        );
      case "LogicalExpression": {
        if (node.operator === "??") return out(node);
        const and = node.operator === "&&";
        const l = bool(node.left, env);
        return val(BOOL, `(${and ? "and" : "or"} ${l} ${scoped(() => bool(node.right, env), and ? l : `(not ${l})`)})`);
      }
      case "UnaryExpression": {
        if (node.operator === "!") return val(BOOL, `(not ${bool(node.argument, env)})`);
        const a = node.operator === "-" ? typed(node.argument, env, "num") : out(node);
        return a.t.k === "int" || node.argument.type === "Literal" ? val(a.t, `(- ${a.e})`) : out(node);
      }
      case "BinaryExpression":
        return binary(node, env);
      case "ObjectExpression":
        return object(node, env, exp);
      case "ArrayExpression": {
        let t = exp?.k === "opt" ? exp.v : exp;
        const [first] = node.elements;
        if (t?.k !== "arr") {
          if (first === undefined || first === null) return out(node);
          const v = must(expr(first.type === "SpreadElement" ? first.argument : first, env), node);
          t = first.type === "SpreadElement" ? v.t : sorts.coll("arr", v.t);
        }
        if (t.k !== "arr") return out(node);
        const S = t.s;
        let acc: string | undefined;
        for (const el of node.elements) {
          const r = name("r");
          if (el === null) return out(node);
          if (el.type !== "SpreadElement") {
            const x = coerce(expr(el, env, t.v), t.v, el);
            acc = `(let ((${r} ${acc ?? `(${S} 0 ((as const (Array Int ${smt(t.v)})) ${S}.d))`})) (${S} (+ (${S}.n ${r}) 1) (store (${S}.a ${r}) (${S}.n ${r}) ${x})))`;
            continue;
          }
          const b = coerce(expr(el.argument, env, t), t, el);
          const [u, i] = [name("r"), name("i")];
          acc =
            acc === undefined
              ? b
              : `(let ((${r} ${acc}) (${u} ${b})) (${S} (+ (${S}.n ${r}) (${S}.n ${u})) (lambda ((${i} Int)) (ite (< ${i} (${S}.n ${r})) ${sel(S, r, i)} ${sel(S, u, `(- ${i} (${S}.n ${r}))`)}))))`;
        }
        return val(t, acc ?? `(${S} 0 ((as const (Array Int ${smt(t.v)})) ${S}.d))`);
      }
      default:
        return out(node);
    }
  };

  return { apply, coerce, must };
}
