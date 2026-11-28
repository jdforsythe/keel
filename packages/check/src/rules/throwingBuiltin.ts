import { globalRefs } from "@keel/compiler/internal";
import { type Node, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { schemaCallee } from "../internal/schemaCallee.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Span = { readonly start: number; readonly end: number };

/** The global functions of k.attempt Throwing built-ins called by name. */
const CALLED: ReadonlySet<string> = new Set(["decodeURIComponent", "decodeURI", "atob", "BigInt"]);
/** Type annotations under which `BigInt` of a name is no string. */
const NOT_TEXT: ReadonlySet<string> = new Set(["TSNumberKeyword", "TSBigIntKeyword", "TSBooleanKeyword"]);
/** Operators whose result is a number, never a string. */
const NUMERIC: ReadonlySet<string> = new Set(["-", "*", "/", "%", "**", "|", "&", "^", "<<", ">>", ">>>"]);

const inside = (x: Span, y: Span): boolean => x.start >= y.start && x.end <= y.end;

/** Whether an argument is a literal: a string, number, boolean or `null`, or a template without substitutions. */
function isLiteral(n: Node): boolean {
  if (n.type === "ParenthesizedExpression") return isLiteral(n.expression);
  return n.type === "Literal" || (n.type === "TemplateLiteral" && n.expressions.length === 0);
}

/**
 * E1457 (k.attempt Throwing built-ins): a bare call, in app code or a library's file, of `JSON.parse`, `new URL`,
 * `decodeURIComponent`, `decodeURI`, `atob` or `BigInt` of a string, with an argument that is no literal, at the
 * callee; none inside a function given to `attempt`. Each callee is the global of that name, not one the file binds.
 * `BigInt` of an argument this file shows to be no string (a number, bigint or boolean annotation or literal, an
 * arithmetic result) is none. No fix (k.fixes Per code).
 */
export const throwingBuiltin: RuleDef = {
  code: "E1457",
  message: (f) => {
    const name = str(f.data, "name");
    if (name === "JSON.parse") return "JSON.parse throws on bad text: parse with a schema, as in Prefs.parseJson(text)";
    if (name === "URL") return "new URL throws on a bad address: use URL.parse(text, base) and test for null";
    return `${name} throws on bad input: call it inside attempt(fn, expect)`;
  },
  see: "k.attempt",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const g = globalRefs(ast);
    const global = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    const isAttempt = schemaCallee(ast, "attempt");
    const given: Span[] = [];
    const typed = new Map<string, string>();
    const hits: { at: number; name: string; arg: Node; call: Span }[] = [];
    const note = (id: Node): void => {
      if (id.type !== "Identifier") return;
      const t = id.typeAnnotation?.typeAnnotation.type;
      if (t !== undefined) typed.set(id.name, t);
    };
    new Visitor({
      VariableDeclarator: (n) => {
        note(n.id);
        const init = n.init;
        if (n.id.type === "Identifier" && init?.type === "Literal" && typeof init.value === "number")
          typed.set(n.id.name, "TSNumberKeyword");
      },
      FunctionDeclaration: (n) => n.params.forEach(note),
      FunctionExpression: (n) => n.params.forEach(note),
      ArrowFunctionExpression: (n) => n.params.forEach(note),
      CallExpression: (n) => {
        const c = n.callee;
        const arg = n.arguments[0];
        if (isAttempt(c)) {
          if (arg?.type === "ArrowFunctionExpression" || arg?.type === "FunctionExpression") given.push(arg);
          return;
        }
        if (arg === undefined || arg.type === "SpreadElement") return;
        if (c.type === "Identifier" && CALLED.has(c.name) && global(c.name, c.start))
          hits.push({ at: c.start, name: c.name, arg, call: n });
        else if (
          c.type === "MemberExpression" &&
          !c.computed &&
          c.property.name === "parse" &&
          c.object.type === "Identifier" &&
          c.object.name === "JSON" &&
          global("JSON", c.object.start)
        )
          hits.push({ at: c.start, name: "JSON.parse", arg, call: n });
      },
      NewExpression: (n) => {
        const c = n.callee;
        const arg = n.arguments[0];
        if (arg === undefined || arg.type === "SpreadElement") return;
        if (c.type === "Identifier" && c.name === "URL" && global("URL", c.start))
          hits.push({ at: c.start, name: "URL", arg, call: n });
      },
    }).visit(ast);
    const notText = (a: Node): boolean => {
      if (a.type === "ParenthesizedExpression") return notText(a.expression);
      if (a.type === "UnaryExpression") return a.operator === "-" || a.operator === "+" || a.operator === "~";
      if (a.type === "BinaryExpression") return NUMERIC.has(a.operator);
      return a.type === "Identifier" && NOT_TEXT.has(typed.get(a.name) ?? "");
    };
    const out: Finding[] = [];
    for (const h of hits) {
      if (isLiteral(h.arg) || given.some((s) => inside(h.call, s))) continue;
      if (h.name === "BigInt" && notText(h.arg)) continue;
      out.push(findingAt(file, h.at, { name: h.name }));
    }
    return out;
  },
};
