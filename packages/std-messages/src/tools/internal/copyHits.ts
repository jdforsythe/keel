import type { SourceFile } from "@keel/check";
import { type ArrowFunctionExpression, type Expression, type Function as Fn, type Program, Visitor } from "oxc-parser";
import type { Hit } from "./Hit.ts";
import { clip } from "./clip.ts";
import { joinPath } from "./joinPath.ts";
import { keyOf } from "./keyOf.ts";
import { parsed } from "./parsed.ts";
import { stringOf } from "./stringOf.ts";
import { unwrap } from "./unwrap.ts";

const LETTER = /\p{L}/u;
/** Attributes and call properties a person reads or hears. */
const PLACES: ReadonlySet<string> = new Set([
  "label",
  "alt",
  "placeholder",
  "title",
  "aria-label",
  "aria-description",
  "aria-placeholder",
  "aria-roledescription",
  "aria-valuetext",
  "children",
]);
/** How far `const` names and title functions are followed. */
const DEPTH = 8;

type FnNode = Fn | ArrowFunctionExpression;
/**
 * What a file declares: `const` initializers and functions by name (`null`: bound some other way), and each
 * function's own `return` arguments (an expression body is its one return).
 */
type Scope = {
  readonly consts: Map<string, Expression | null>;
  readonly fns: Map<string, FnNode>;
  readonly returns: Map<FnNode, Expression[]>;
};

const scopes = new WeakMap<Program, Scope>();

function scopeOf(program: Program): Scope {
  const hit = scopes.get(program);
  if (hit !== undefined) return hit;
  const consts = new Map<string, Expression | null>();
  const fns = new Map<string, FnNode>();
  const returns = new Map<FnNode, Expression[]>();
  const stack: FnNode[] = [];
  const enter = (f: FnNode): void => {
    stack.push(f);
    returns.set(f, f.type === "ArrowFunctionExpression" && f.body.type !== "BlockStatement" ? [f.body] : []);
  };
  const exit = (): void => void stack.pop();
  const bind = (name: string, init: Expression | null): void => {
    consts.set(name, consts.has(name) ? null : init);
  };
  new Visitor({
    VariableDeclaration: (v) => {
      for (const d of v.declarations) {
        if (d.id.type !== "Identifier") continue;
        const init = d.init === null ? null : unwrap(d.init);
        bind(d.id.name, v.kind === "const" ? init : null);
        if (init?.type === "ArrowFunctionExpression" || init?.type === "FunctionExpression") fns.set(d.id.name, init);
      }
    },
    FunctionDeclaration: (f) => {
      if (f.id !== null) fns.set(f.id.name, f);
      enter(f);
    },
    "FunctionDeclaration:exit": exit,
    FunctionExpression: enter,
    "FunctionExpression:exit": exit,
    ArrowFunctionExpression: enter,
    "ArrowFunctionExpression:exit": exit,
    ReturnStatement: (r) => {
      const top = stack[stack.length - 1];
      if (top !== undefined && r.argument !== null) returns.get(top)?.push(r.argument);
    },
  }).visit(program);
  const scope = { consts, fns, returns };
  scopes.set(program, scope);
  return scope;
}

/**
 * E2406 hits in one app file of a module listing the package (std.copy): in a `.tsx` file, JSX text and expression
 * children and the listed attributes; in every file, the listed properties of an object literal passed to an uppercase
 * identifier callee; in `routes.ts`, what a route `title` returns. A value counts through `?:`, `||`, `??`, the right
 * of `&&`, thunk bodies, templates and `+` with a lettered part, and `const` names (same file or a project import),
 * reported at the use.
 */
export function copyHits(program: Program, path: string, project: readonly SourceFile[]): Hit[] {
  const jsx = /\.[jt]sx$/.test(path);
  const routes = path === "routes.ts" || path.endsWith("/routes.ts");
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  const out: Hit[] = [];
  const hit = (at: number, text: string): void =>
    void out.push({ at, msg: `literal copy '${clip(text.trim())}'; read it from a message set` });

  /** The `const` initializer `name` binds in `program`, or through its import from a project file. */
  const constOf = (name: string, prog: Program, from: string, depth: number): [Expression, Program, string] | null => {
    if (depth > DEPTH) return null;
    const own = scopeOf(prog).consts.get(name);
    if (own !== undefined) return own === null ? null : [own, prog, from];
    for (const st of prog.body) {
      if (st.type !== "ImportDeclaration" || st.importKind === "type" || !st.source.value.startsWith(".")) continue;
      const spec = st.specifiers.find((s) => s.local.name === name);
      if (spec === undefined || spec.type !== "ImportSpecifier") continue;
      const target = joinPath(from.slice(0, from.lastIndexOf("/") + 1), st.source.value);
      const file = project.find((f) => f.path === target || f.path === `${target}.ts` || f.path === `${target}.tsx`);
      const ast = file === undefined ? undefined : parsed(file);
      const imported = spec.imported.type === "Identifier" ? spec.imported.name : String(spec.imported.value);
      return ast === undefined || file === undefined ? null : constOf(imported, ast, file.path, depth + 1);
    }
    return null;
  };

  /** The lettered text of `e` when it is copy by itself (a literal, a template or a `+` with a lettered part). */
  const textOf = (e: Expression, prog: Program, from: string, depth: number): string | null => {
    const x = unwrap(e);
    const s = stringOf(x);
    if (s !== undefined) return LETTER.test(s.value) ? s.value : null;
    if (x.type === "TemplateLiteral") {
      const text = x.quasis.map((q) => q.value.cooked ?? q.value.raw).join("…");
      return LETTER.test(x.quasis.map((q) => q.value.cooked ?? q.value.raw).join("")) ? text : null;
    }
    if (x.type === "BinaryExpression" && x.operator === "+") {
      return textOf(x.left, prog, from, depth) ?? textOf(x.right, prog, from, depth);
    }
    if (x.type === "Identifier" && depth < DEPTH) {
      const c = constOf(x.name, prog, from, 0);
      return c === null ? null : valueText(c[0], c[1], c[2], depth + 1);
    }
    return null;
  };
  /** Copy among the values `e` can take (branches, thunk bodies), for a `const` initializer. */
  const valueText = (e: Expression, prog: Program, from: string, depth: number): string | null => {
    for (const b of branches(e)) {
      const t = textOf(b, prog, from, depth);
      if (t !== null) return t;
    }
    return null;
  };
  /** Each value `e` can take: both branches of `?:`, both sides of `||` and `??`, the right of `&&`, a thunk's body. */
  const branches = (e: Expression): Expression[] => {
    const x = unwrap(e);
    if (x.type === "ConditionalExpression") return [...branches(x.consequent), ...branches(x.alternate)];
    if (x.type === "LogicalExpression")
      return x.operator === "&&" ? branches(x.right) : [...branches(x.left), ...branches(x.right)];
    if (x.type === "ArrowFunctionExpression" && x.body.type !== "BlockStatement") return branches(x.body);
    return [x];
  };
  const place = (e: Expression): void => {
    for (const b of branches(e)) {
      const t = textOf(b, program, path, 0);
      if (t === null) continue;
      const lit = b.type === "BinaryExpression" ? firstLettered(b) : b;
      hit(lit.start, t);
    }
  };
  /** The operand of a `+` chain that holds the letter: the literal reported. */
  const firstLettered = (e: Expression): Expression => {
    const x = unwrap(e);
    if (x.type !== "BinaryExpression" || x.operator !== "+") return x;
    return textOf(x.left, program, path, 0) !== null ? firstLettered(x.left) : firstLettered(x.right);
  };

  const titled = new Set<FnNode>();
  /** A route `title` value: its function's returns, or the same-file function it names or calls. */
  const title = (e: Expression, depth: number): void => {
    const x = unwrap(e);
    if (x.type === "ArrowFunctionExpression" || x.type === "FunctionExpression") {
      titleFn(x, depth);
      return;
    }
    const named = x.type === "Identifier" ? x : x.type === "CallExpression" ? unwrap(x.callee) : undefined;
    const fn = named?.type === "Identifier" ? scopeOf(program).fns.get(named.name) : undefined;
    if (fn !== undefined) titleFn(fn, depth);
    else if (x.type !== "CallExpression") place(x);
  };
  const titleFn = (fn: FnNode, depth: number): void => {
    if (titled.has(fn) || depth > DEPTH) return;
    titled.add(fn);
    for (const r of scopeOf(program).returns.get(fn) ?? []) for (const b of branches(r)) title(b, depth + 1);
  };

  new Visitor({
    JSXElement: (n) => {
      if (jsx)
        for (const c of n.children)
          if (c.type === "JSXExpressionContainer" && c.expression.type !== "JSXEmptyExpression") place(c.expression);
    },
    JSXFragment: (n) => {
      if (jsx)
        for (const c of n.children)
          if (c.type === "JSXExpressionContainer" && c.expression.type !== "JSXEmptyExpression") place(c.expression);
    },
    JSXText: (n) => {
      if (!jsx || !LETTER.test(n.value)) return;
      hit(n.start + n.value.length - n.value.trimStart().length, n.value);
    },
    JSXAttribute: (n) => {
      if (!jsx || n.value === null) return;
      const name = n.name.type === "JSXIdentifier" ? n.name.name : undefined;
      if (name === undefined || !PLACES.has(name)) return;
      if (n.value.type === "Literal") place(n.value);
      else if (n.value.type === "JSXExpressionContainer" && n.value.expression.type !== "JSXEmptyExpression")
        place(n.value.expression);
    },
    CallExpression: (n) => {
      const callee = unwrap(n.callee);
      const arg = n.arguments[0];
      if (callee.type !== "Identifier" || !/^[A-Z]/.test(callee.name) || arg?.type !== "ObjectExpression") return;
      for (const p of arg.properties) {
        const key = keyOf(p);
        if (p.type === "Property" && key !== undefined && PLACES.has(key)) place(p.value);
      }
    },
    ObjectExpression: (o) => {
      if (routes) for (const p of o.properties) if (p.type === "Property" && keyOf(p) === "title") title(p.value, 0);
    },
  }).visit(program);
  return out;
}
