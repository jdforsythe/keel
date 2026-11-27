import { type Node, Visitor } from "oxc-parser";
import { DEFECT_CODE_MESSAGE } from "../internal/DEFECT_CODE_MESSAGE.ts";
import { DEFECT_DETAIL_MESSAGE } from "../internal/DEFECT_DETAIL_MESSAGE.ts";
import { DEFECT_TEXT_MESSAGE } from "../internal/DEFECT_TEXT_MESSAGE.ts";
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

/** Whether a property key is `name`, written as a name or a string. */
const keyIs = (k: Node, name: string): boolean =>
  (k.type === "Identifier" && k.name === name) || (k.type === "Literal" && k.value === name);

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
 * string literal or template without substitutions, at it; whose detail's `code` is no string literal of `E` and four
 * digits, at that value; or whose second argument is no object literal without a spread, or that has a third, at it.
 * These spellings are read without the type pass; with it, `calleeUses` finds `defect` by its symbol (k.unsafe One
 * path). In both, a `defect` call with no `cause` where a `Result` named `r` is known not ok (`if (!r.ok)`, the `else`
 * of `if (r.ok)`, the failing arm of `r.ok ? a : b` or `r.ok || b`), at the call; its fix (k.fixes Per code) adds the
 * detail `{ cause: r.error }`, or to a detail object literal with no spread, `cause: r.error` as its last property.
 */
export const defectCode: RuleDef = {
  code: "E1455",
  message: (f) => {
    const kind = str(f.data, "kind");
    if (kind === "message") return DEFECT_TEXT_MESSAGE;
    if (kind === "detail") return DEFECT_DETAIL_MESSAGE;
    if (kind === "unread") return "defect code check cannot read";
    if (kind === "failed") return `defect on a failed Result: pass { cause: ${str(f.data, "name")}.error }`;
    return DEFECT_CODE_MESSAGE;
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
      const [message, detail, extra] = n.arguments;
      const object = detail?.type === "ObjectExpression" ? detail : undefined;
      const readable =
        object !== undefined && object.properties.every((p) => p.type !== "SpreadElement" && !p.computed);
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
        if (detail !== undefined && !readable) out.push(findingAt(file, detail.start, { kind: "detail" }));
        const code = readable
          ? object.properties.find((p) => p.type === "Property" && keyIs(p.key, "code"))
          : undefined;
        const value = code?.type === "Property" ? code.value : undefined;
        if (
          value !== undefined &&
          !(value.type === "Literal" && typeof value.value === "string" && CODE.test(value.value))
        )
          out.push(findingAt(file, value.start, { kind: "code" }));
        if (extra !== undefined) out.push(findingAt(file, extra.start, { kind: "detail" }));
      }
      // A detail check cannot read may hold a `cause`.
      const hasCause =
        detail !== undefined &&
        (!readable || object.properties.some((p) => p.type === "Property" && keyIs(p.key, "cause")));
      if (hasCause) continue;
      const hit = failed.find(
        (r) => inside(n, r) && !fns.some((f) => inside(f, r) && inside(n, f) && f.start > r.start),
      );
      if (hit === undefined) continue;
      const last = object?.properties[object.properties.length - 1];
      // The fix's edit: the detail `{ cause: r.error }` after the message, in place of `{}`, or `cause` after the
      // detail's last property.
      const edit =
        n.arguments.length > 2 || message === undefined
          ? undefined
          : object === undefined
            ? { start: message.end, end: message.end, text: `, { cause: ${hit.name}.error }` }
            : last === undefined
              ? { start: object.start, end: object.end, text: `{ cause: ${hit.name}.error }` }
              : { start: last.end, end: last.end, text: `, cause: ${hit.name}.error` };
      out.push(
        findingAt(file, n.start, {
          kind: "failed",
          name: hit.name,
          fixable: edit === undefined ? 0 : 1,
          start: edit?.start ?? -1,
          end: edit?.end ?? -1,
          text: edit?.text ?? "",
        }),
      );
    }
    return out;
  },
  fix: (f) => {
    if (str(f.data, "kind") !== "failed" || num(f.data, "fixable", 0) !== 1) return null;
    const start = num(f.data, "start");
    if (start < 0) return null;
    return [{ start, end: num(f.data, "end"), text: str(f.data, "text") }];
  },
};
