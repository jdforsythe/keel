import { globalRefs } from "@keel/compiler/internal";
import { type Argument, type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { givenValues } from "../internal/givenValues.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Links followed before giving up, as in E1603. */
const MAX_DEPTH = 16;
/** Operators whose result does not hold an operand: comparisons and tests. */
const TESTS: ReadonlySet<string> = new Set([
  ...["===", "!==", "==", "!=", "<", ">", "<=", ">=", "in", "instanceof"],
  ...["!", "typeof", "void", "delete"],
]);
/** Calls that keep their argument's value. */
const KEEPS: ReadonlySet<string> = new Set(["String", "JSON.stringify"]);

/**
 * E1112 (k.privacy): in app code, an argument carrying a value `reveal` (`@keel/schema`, any alias, or
 * `<namespace>.reveal`) returns, given to `tx` or `store` (`@keel/store`, by binding), `set` or `commit` on a member
 * or binding named `storage`, a `console` method, or a global whose name ends in `Error`, called or constructed.
 * A value carries one when it is the call, a local any of whose given values (E1603's walk, destructuring included)
 * carries one, a member, spread, literal, template, operator other than a test, `?:`, `await`, `String()` or
 * `JSON.stringify()` of one, or a method called on one. Any other call, a parameter and an import end it. One
 * finding per sink call, at the first carrying argument; no fix (what to derive is the author's choice).
 */
export const revealedValue: RuleDef = {
  code: "E1112",
  message: (f) => `a revealed value reaches ${str(f.data, "sink")}; store a value derived from it`,
  explain: "Logs, storage and state keep a revealed value as written. Pass the Secret, or store a derived value.",
  see: "k.privacy",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const reveals = localNames(ast, "reveal", "@keel/schema");
    const namespaces = new Set<string>();
    for (const st of ast.body)
      if (st.type === "ImportDeclaration" && st.source.value === "@keel/schema")
        for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
    if (reveals.size === 0 && namespaces.size === 0) return [];
    const g = globalRefs(ast);
    const imported = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    const sinks = new Map<string, string>();
    for (const name of ["tx", "store"]) for (const l of localNames(ast, name, "@keel/store")) sinks.set(l, name);
    const values = givenValues(ast, true);
    const memo = new Map<Expression, boolean>();
    const isReveal = (c: Expression): boolean =>
      c.type === "Identifier"
        ? reveals.has(c.name) && imported(c.name, c.start)
        : c.type === "MemberExpression" &&
          !c.computed &&
          c.object.type === "Identifier" &&
          namespaces.has(c.object.name) &&
          imported(c.object.name, c.object.start) &&
          c.property.name === "reveal";
    const carries = (e: Argument | null | undefined, d: number): boolean => {
      if (e === null || e === undefined || d > MAX_DEPTH) return false;
      const next = (x: Argument | null | undefined): boolean => carries(x, d + 1);
      switch (e.type) {
        case "Identifier":
          return (values.get(e.name) ?? []).some(({ at, v }) => {
            if (!g.sameBinding(e.name, at, e.start)) return false;
            const known = memo.get(v);
            if (known !== undefined) return known;
            memo.set(v, false);
            const r = next(v);
            memo.set(v, r);
            return r;
          });
        case "CallExpression":
          if (isReveal(e.callee)) return true;
          if (KEEPS.has(g.resolve(e.callee)?.join(".") ?? "")) return next(e.arguments[0]);
          return e.callee.type === "MemberExpression" && next(e.callee.object);
        case "MemberExpression":
          return next(e.object);
        case "ObjectExpression":
          return e.properties.some((p) => next(p.type === "SpreadElement" ? p.argument : p.value));
        case "ArrayExpression":
          return e.elements.some(next);
        case "TemplateLiteral":
          return e.expressions.some(next);
        case "BinaryExpression":
          return !TESTS.has(e.operator) && (next(e.right) || (e.left.type !== "PrivateIdentifier" && next(e.left)));
        case "LogicalExpression":
          return next(e.left) || next(e.right);
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
        case "ParenthesizedExpression":
        case "ChainExpression":
        case "TSAsExpression":
        case "TSSatisfiesExpression":
        case "TSNonNullExpression":
          return next(e.expression);
        default:
          return false;
      }
    };
    const sinkOf = (c: Expression): string | null => {
      if (c.type === "Identifier" && imported(c.name, c.start)) {
        const s = sinks.get(c.name);
        if (s !== undefined) return s;
      }
      if (c.type === "MemberExpression" && !c.computed && (c.property.name === "set" || c.property.name === "commit")) {
        const o = c.object;
        const named =
          o.type === "Identifier" ? o.name : o.type === "MemberExpression" && !o.computed ? o.property.name : "";
        if (named === "storage") return `storage.${c.property.name}`;
      }
      const p = g.resolve(c);
      if (p?.length === 2 && p[0] === "console") return p.join(".");
      return p?.length === 1 && p[0]?.endsWith("Error") === true ? p[0] : null;
    };
    const out: Finding[] = [];
    const call = (n: { readonly callee: Expression; readonly arguments: readonly Argument[] }): void => {
      const sink = sinkOf(n.callee);
      const arg = sink === null ? undefined : n.arguments.find((a) => carries(a, 0));
      if (sink !== null && arg !== undefined) out.push(findingAt(file, arg.start, { sink }));
    };
    new Visitor({ CallExpression: call, NewExpression: call }).visit(ast);
    return out;
  },
};
