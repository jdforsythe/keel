import { type Node, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { schemaCallee } from "../internal/schemaCallee.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** A defect's code as k.defects names it: `E` and four digits. */
const CODE = /^E\d{4}$/;

type Span = { readonly start: number; readonly end: number };
/** Where the `Result` named `name` is known not ok. */
type Failed = Span & { readonly name: string };

const inside = (x: Span, y: Span): boolean => x.start >= y.start && x.end <= y.end;

/** The name `X` of a test `X.ok`, else `undefined`. */
function okOf(n: Node): string | undefined {
  if (n.type === "ParenthesizedExpression") return okOf(n.expression);
  if (n.type !== "MemberExpression" || n.computed || n.property.name !== "ok") return undefined;
  return n.object.type === "Identifier" ? n.object.name : undefined;
}

/** The name `X` of a test that holds only when `X` is not ok: `!X.ok`, `X.ok === false`, `X.ok == false`. */
function notOkOf(n: Node): string | undefined {
  if (n.type === "ParenthesizedExpression") return notOkOf(n.expression);
  if (n.type === "UnaryExpression" && n.operator === "!") return okOf(n.argument);
  if (n.type !== "BinaryExpression" || (n.operator !== "===" && n.operator !== "==")) return undefined;
  const isFalse = (x: Node): boolean => x.type === "Literal" && x.value === false;
  if (isFalse(n.right)) return okOf(n.left);
  return isFalse(n.left) ? okOf(n.right) : undefined;
}

/**
 * E1455 (k.defects): a call of `defect` from `@keel/schema` (any alias, or `<namespace>.defect`) whose message is no
 * string literal or template without substitutions, whose code argument is no string literal of `E` and four digits,
 * or whose detail is no object literal, at that argument; the second argument is the detail when it is an object
 * literal, else the code. These spellings are read without the type pass; with it, `calleeUses` finds `defect` by its
 * symbol (k.unsafe One path). In both, a `defect` call with no `cause` where a `Result` named `r` is known not ok
 * (`if (!r.ok)`, the `else` of `if (r.ok)`, the failing arm of `r.ok ? a : b` or `r.ok || b`), at the call; its fix
 * (k.fixes Per code), for `defect(message)` and `defect(message, code)`, adds the detail `{ cause: r.error }`.
 */
export const defectCode: RuleDef = {
  code: "E1455",
  message: (f) => {
    const kind = str(f.data, "kind");
    if (kind === "message") return "defect message is not a literal: pass values as data, defect('text', { data })";
    if (kind === "detail") return "defect detail is not an object literal";
    if (kind === "unread") return "defect code check cannot read";
    if (kind === "failed") return `defect on a failed Result: pass { cause: ${str(f.data, "name")}.error }`;
    return "defect code is not a literal E and four digits";
  },
  see: "k.errors",
  check: ({ file, ast, types }) => {
    if (!isAppPath(file.path)) return [];
    const isDefect = schemaCallee(ast, "defect");
    const out: Finding[] = [];
    const failed: Failed[] = [];
    const fns: Span[] = [];
    const calls: Node[] = [];
    const fn = (n: Span): void => void fns.push(n);
    new Visitor({
      FunctionDeclaration: fn,
      FunctionExpression: fn,
      ArrowFunctionExpression: fn,
      IfStatement: (n) => {
        const not = notOkOf(n.test);
        if (not !== undefined) failed.push({ start: n.consequent.start, end: n.consequent.end, name: not });
        const yes = okOf(n.test);
        if (yes !== undefined && n.alternate !== null)
          failed.push({ start: n.alternate.start, end: n.alternate.end, name: yes });
      },
      ConditionalExpression: (n) => {
        const not = notOkOf(n.test);
        if (not !== undefined) failed.push({ start: n.consequent.start, end: n.consequent.end, name: not });
        const yes = okOf(n.test);
        if (yes !== undefined) failed.push({ start: n.alternate.start, end: n.alternate.end, name: yes });
      },
      LogicalExpression: (n) => {
        const yes = n.operator === "||" ? okOf(n.left) : n.operator === "&&" ? notOkOf(n.left) : undefined;
        if (yes !== undefined) failed.push({ start: n.right.start, end: n.right.end, name: yes });
      },
      CallExpression: (n) => {
        if (isDefect(n.callee)) calls.push(n);
      },
    }).visit(ast);
    for (const n of calls) {
      if (n.type !== "CallExpression") continue;
      const [message, second, third] = n.arguments;
      if (types !== true) {
        const spread = n.arguments.find((a) => a.type === "SpreadElement");
        if (spread !== undefined) {
          out.push(findingAt(file, spread.start, { kind: "unread" }));
          continue;
        }
        const literal =
          message === undefined ||
          (message.type === "Literal" && typeof message.value === "string") ||
          (message.type === "TemplateLiteral" && message.expressions.length === 0);
        if (!literal) out.push(findingAt(file, message.start, { kind: "message" }));
        const detailSecond = second?.type === "ObjectExpression";
        if (second !== undefined && !detailSecond) {
          if (!(second.type === "Literal" && typeof second.value === "string" && CODE.test(second.value)))
            out.push(findingAt(file, second.start, { kind: "code" }));
          if (third !== undefined && third.type !== "ObjectExpression")
            out.push(findingAt(file, third.start, { kind: "detail" }));
        }
      }
      const detail = second?.type === "ObjectExpression" ? second : third;
      const hasCause =
        detail === undefined
          ? false
          : detail.type !== "ObjectExpression" ||
            detail.properties.some(
              (p) =>
                p.type === "SpreadElement" ||
                p.computed ||
                (p.key.type === "Identifier" && p.key.name === "cause") ||
                (p.key.type === "Literal" && p.key.value === "cause"),
            );
      if (hasCause) continue;
      const hit = failed.find(
        (r) => inside(n, r) && !fns.some((f) => inside(f, r) && inside(n, f) && f.start > r.start),
      );
      if (hit === undefined) continue;
      const last = n.arguments[n.arguments.length - 1];
      out.push(
        findingAt(file, n.start, {
          kind: "failed",
          name: hit.name,
          fixable: detail === undefined && last !== undefined ? 1 : 0,
          after: last?.end ?? -1,
        }),
      );
    }
    return out;
  },
  fix: (f) => {
    if (str(f.data, "kind") !== "failed" || num(f.data, "fixable", 0) !== 1) return null;
    const after = num(f.data, "after");
    if (after < 0) return null;
    return [{ start: after, end: after, text: `, { cause: ${str(f.data, "name")}.error }` }];
  },
};
