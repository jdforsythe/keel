import { globalRefs, unwrapExpression as unwrap } from "@keel/compiler/internal";
import type { Argument, Expression, Program } from "oxc-parser";
import { givenAt } from "./givenAt.ts";
import { keyName } from "./keyName.ts";

/** Links followed before giving up, as in E1603. */
const MAX_DEPTH = 16;
/** Operators whose result does not hold an operand: comparisons and tests. */
const TESTS: ReadonlySet<string> = new Set([
  ...["===", "!==", "==", "!=", "<", ">", "<=", ">=", "in", "instanceof"],
  ...["!", "typeof", "void", "delete"],
]);
/** Calls whose result holds an argument: conversions, copies and encodings that can be reversed. */
const KEEPS: ReadonlySet<string> = new Set([
  ...["String", "String.raw", "JSON.stringify", "structuredClone", "Array.from", "Array.of", "Object.assign"],
  ...["Object.values", "Object.entries", "Object.fromEntries", "Map", "Set", "btoa", "encodeURI"],
  ...["encodeURIComponent", "Buffer.from"],
]);
/** `KEEPS` entries that carry when constructed. */
const NEWS = /^(String|Map|Set)$/;
/** Members that are a count, not the value. */
const COUNTS: ReadonlySet<string> = new Set(["length", "size"]);
/** Methods whose result is a test or a position. */
const ASKS: ReadonlySet<string> = new Set(["includes", "startsWith", "endsWith", "indexOf", "has"]);
/** Methods whose result holds an argument as well as the receiver. */
const JOINS: ReadonlySet<string> = new Set([
  ...["concat", "replace", "replaceAll", "padStart", "padEnd"],
  ...["fill", "set", "add"],
]);
type Flow = {
  /** Whether `e` carries a value `reveal` returns, read where it stands. */
  readonly carries: (e: Argument | null | undefined) => boolean;
  readonly g: ReturnType<typeof globalRefs>;
  readonly live: ReturnType<typeof givenAt>["live"];
  readonly under: ReturnType<typeof givenAt>["under"];
  /** The values the local `name` read at `at` is bound to whole: initializers and assignments. */
  readonly bound: (name: string, at: number) => Expression[];
  /** Whether `name` read at `at` is the file's top-level binding (an import), not a local. */
  readonly imported: (name: string, at: number) => boolean;
};

const flows = new WeakMap<Program, Flow | null>();

/**
 * The value walk of k.reveal Flow over `ast` (E1112, `carriesReveal`), or `null` when the file imports neither
 * `reveal` nor a namespace of `@keel/schema`. A value carries one when it is a `reveal` call (the `@keel/schema` import,
 * any alias, `<namespace>.reveal`, or a local bound to one); a local a live given value carries (`givenAt`); a spread,
 * literal, template, operator other than a test, `?:` or `await` of one; the right side of `&&`; a member of one other
 * than `length` and `size` (of an object literal or a local, the named field only; a destructured name at its field);
 * a method called on one other than the tests in `ASKS`; a `JOINS` method given one; or a `KEEPS` call of one, or a
 * `new` of `String`, `Map` or `Set`. Any other call, a parameter and an import end it. One walk per program, its
 * answers kept.
 */
export function revealFlow(ast: Program): Flow | null {
  const known = flows.get(ast);
  if (known !== undefined) return known;
  const reveals = new Set<string>();
  const spaces = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
      else if (
        sp.type === "ImportSpecifier" &&
        (sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value) === "reveal"
      )
        reveals.add(sp.local.name);
    }
  }
  if (reveals.size === 0 && spaces.size === 0) {
    flows.set(ast, null);
    return null;
  }
  const g = globalRefs(ast);
  const imported = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
  const { live, under } = givenAt(ast, g);
  /** The values the local `name` read at `at` is bound to whole: initializers and assignments. */
  const bound = (name: string, at: number): Expression[] =>
    live(name, at).flatMap((x) => (x.key === undefined ? [x.v] : []));
  const isReveal = (callee: Expression, d: number): boolean => {
    const c = unwrap(callee);
    if (c.type === "Identifier")
      return (
        (reveals.has(c.name) && imported(c.name, c.start)) ||
        (d < MAX_DEPTH && bound(c.name, c.start).some((v) => isReveal(v, d + 1)))
      );
    return (
      c.type === "MemberExpression" &&
      !c.computed &&
      c.property.name === "reveal" &&
      c.object.type === "Identifier" &&
      spaces.has(c.object.name) &&
      imported(c.object.name, c.object.start)
    );
  };
  const memo = new Map<Expression, Map<string | undefined, boolean>>();
  /** `carries(v, key)` for a given value, each answered once; a value that reaches itself carries nothing more. */
  const once = (v: Expression, key: string | undefined, d: number): boolean => {
    const seen = memo.get(v) ?? new Map<string | undefined, boolean>();
    memo.set(v, seen);
    const known = seen.get(key);
    if (known !== undefined) return known;
    seen.set(key, false);
    const r = carries(v, key, d + 1);
    seen.set(key, r);
    return r;
  };
  /** Whether `e` carries a revealed value, or with `key`, whether its field `key` does. */
  const carries = (e: Argument | null | undefined, key: string | undefined, d: number): boolean => {
    if (e === null || e === undefined || d > MAX_DEPTH) return false;
    const next = (x: Argument | null | undefined): boolean => carries(x, undefined, d + 1);
    /** Whether a read of `key` reads the field `name` (null: any field). */
    const reads = (name: string | null): boolean => key === undefined || name === null || name === key;
    switch (e.type) {
      case "Identifier":
        // A destructured name read at a member: its field, then that member of it.
        return live(e.name, e.start).some((x) =>
          x.field !== undefined
            ? reads(x.field) && next(x.v)
            : typeof x.key === "string" && key !== undefined
              ? !COUNTS.has(key) && once(x.v, x.key, d)
              : once(x.v, x.key ?? key, d),
        );
      case "ObjectExpression":
        return e.properties.some((p) =>
          p.type === "SpreadElement" ? next(p.argument) : reads(keyName(p)) && next(p.value),
        );
      case "ParenthesizedExpression":
      case "ChainExpression":
      case "TSAsExpression":
      case "TSSatisfiesExpression":
      case "TSNonNullExpression":
        return carries(e.expression, key, d + 1);
    }
    if (key !== undefined) return !COUNTS.has(key) && next(e);
    switch (e.type) {
      case "CallExpression":
      case "NewExpression": {
        const c = e.callee;
        if (e.type === "CallExpression" && isReveal(c, 0)) return true;
        const path = g.resolve(c)?.join(".");
        if (path !== undefined && KEEPS.has(path) && (NEWS.test(path) || e.type === "CallExpression"))
          return e.arguments.some(next);
        if (e.type === "NewExpression" || c.type !== "MemberExpression") return false;
        const m = (c.computed ? g.constString(c.property) : c.property.name) ?? "";
        return !ASKS.has(m) && (next(c.object) || (JOINS.has(m) && e.arguments.some(next)));
      }
      case "TaggedTemplateExpression":
        return g.resolve(e.tag)?.join(".") === "String.raw" && e.quasi.expressions.some(next);
      case "MemberExpression":
        return carries(e.object, e.computed ? (g.constString(e.property) ?? undefined) : e.property.name, d + 1);
      case "ArrayExpression":
        return e.elements.some(next);
      case "TemplateLiteral":
        return e.expressions.some(next);
      case "BinaryExpression":
        return !TESTS.has(e.operator) && (next(e.right) || (e.left.type !== "PrivateIdentifier" && next(e.left)));
      case "LogicalExpression":
        return (e.operator !== "&&" && next(e.left)) || next(e.right);
      case "ConditionalExpression":
        return next(e.consequent) || next(e.alternate);
      case "UnaryExpression":
        return !TESTS.has(e.operator) && next(e.argument);
      case "AssignmentExpression":
        return next(e.right);
      case "SequenceExpression":
        return next(e.expressions[e.expressions.length - 1]);
      case "SpreadElement":
      case "AwaitExpression":
        return next(e.argument);
      default:
        return false;
    }
  };
  const flow: Flow = { carries: (e) => carries(e, undefined, 0), g, live, under, bound, imported };
  flows.set(ast, flow);
  return flow;
}
