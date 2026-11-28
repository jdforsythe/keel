import ts from "typescript";
import type { Placed } from "./Placed.ts";

/** The called name: `f` of `f(...)` and `x.f(...)`. */
function calleeName(call: ts.CallExpression): string | null {
  const c = call.expression;
  if (ts.isIdentifier(c)) return c.text;
  return ts.isPropertyAccessExpression(c) ? c.name.text : null;
}

const within = (n: ts.Node, outer: ts.Node): boolean => n.getStart() >= outer.getStart() && n.end <= outer.end;

/** A literal or a name: a value whose type error is the member's own, not one inside an expression. */
function plain(e: ts.Node): boolean {
  if (ts.isPrefixUnaryExpression(e)) return ts.isNumericLiteral(e.operand);
  return (
    ts.isIdentifier(e) ||
    ts.isStringLiteralLike(e) ||
    ts.isNumericLiteral(e) ||
    e.kind === ts.SyntaxKind.TrueKeyword ||
    e.kind === ts.SyntaxKind.FalseKeyword ||
    e.kind === ts.SyntaxKind.NullKeyword
  );
}

/** Whether `node`, inside `entry`, is on its surface: the key, the value object, a member's key, or a member's plain value. */
function onSurface(node: ts.Node, entry: ts.PropertyAssignment, member: ts.ObjectLiteralElementLike | null): boolean {
  if (within(node, entry.name)) return true;
  if (member === null) return node === entry.initializer || plain(entry.initializer);
  if (member.name !== undefined && within(node, member.name)) return true;
  if (ts.isShorthandPropertyAssignment(member)) return true;
  return ts.isPropertyAssignment(member) && plain(member.initializer) && within(node, member.initializer);
}

/**
 * Where `node` sits in argument `index` of the innermost enclosing call to `name` (`contract`, `manifest`), when
 * that argument is an object literal: the entry (a property of the argument) and the entry's member holding it.
 * `null` when no such call encloses the node, when a function or another call lies between them, or when the node is
 * inside a member's value that is neither a literal nor a name: an error there is the expression's own (E1751).
 */
export function placeIn(node: ts.Node, name: string, index: number): Placed | null {
  const elements: ts.ObjectLiteralElementLike[] = [];
  let prev: ts.Node = node;
  for (let p: ts.Node | undefined = node; p !== undefined; prev = p, p = p.parent) {
    if (ts.isFunctionLike(p) || ts.isNewExpression(p)) return null;
    if (ts.isObjectLiteralElementLike(p)) elements.push(p);
    if (!ts.isCallExpression(p)) continue;
    if (calleeName(p) !== name) return null;
    const arg = p.arguments[index];
    if (arg === undefined || !ts.isObjectLiteralExpression(arg) || !within(prev, arg)) return null;
    const at = elements.findIndex((e) => e.parent === arg);
    const found = elements[at];
    const entry = found !== undefined && ts.isPropertyAssignment(found) ? found : null;
    const inner = at > 0 ? elements[at - 1] : undefined;
    const member = entry !== null && inner !== undefined && inner.parent === entry.initializer ? inner : null;
    if (entry !== null && !onSurface(node, entry, member)) return null;
    return { call: p, arg, entry, atKey: entry !== null && within(node, entry.name), member };
  }
  return null;
}
