import ts from "typescript";
import { isSchemaExport } from "./isSchemaExport.ts";
import { throwOwners } from "./throwOwners.ts";

type Owner = (fileName: string) => string | null;

/** Whether `t` is a `KeelError`: a string `code`, a string `message` and a `data`. */
function isKeelError(t: ts.Type, checker: ts.TypeChecker): boolean {
  const code = checker.getPropertyOfType(t, "code");
  const message = checker.getPropertyOfType(t, "message");
  if (code === undefined || message === undefined || checker.getPropertyOfType(t, "data") === undefined) return false;
  const text = (s: ts.Symbol): boolean => (checker.getTypeOfSymbol(s).flags & ts.TypeFlags.StringLike) !== 0;
  return text(code) && text(message);
}

/** `n` when it is a function declaration, expression, arrow function, method or getter, else `undefined`. */
const functionOf = (n: ts.Node): ts.FunctionLikeDeclaration | undefined =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) ||
  ts.isGetAccessorDeclaration(n)
    ? n
    : undefined;

/** Whether `fn` is the first argument of a call of `@keel/schema`'s `attempt`. */
function givenToAttempt(fn: ts.Node, checker: ts.TypeChecker, ownerOf: Owner): boolean {
  let o = fn;
  while (ts.isParenthesizedExpression(o.parent)) o = o.parent;
  const p = o.parent;
  return ts.isCallExpression(p) && p.arguments[0] === o && isSchemaExport(p.expression, "attempt", checker, ownerOf);
}

/** Whether `fn`'s return type, awaited when `fn` is `async`, takes `Result<never, E>` with `E` taking `thrown`. */
function takesFailure(fn: ts.FunctionLikeDeclaration, thrown: ts.Type, checker: ts.TypeChecker): boolean {
  const sig = checker.getSignatureFromDeclaration(fn);
  if (sig === undefined) return false;
  const declared = sig.getReturnType();
  const async = (ts.getCombinedModifierFlags(fn) & ts.ModifierFlags.Async) !== 0;
  const r = async ? (checker.getAwaitedType(declared) ?? declared) : declared;
  const members = r.isUnion() ? r.types : [r];
  return members.some((m) => {
    const ok = checker.getPropertyOfType(m, "ok");
    const error = checker.getPropertyOfType(m, "error");
    if (ok === undefined || error === undefined) return false;
    if (checker.typeToString(checker.getTypeOfSymbol(ok)) !== "false") return false;
    return checker.isTypeAssignableTo(thrown, checker.getTypeOfSymbol(error));
  });
}

/**
 * E1451's fix sites (k.fixes Per code): the start offsets of the `throw` statements whose value's type is a
 * `KeelError`, directly in a function whose return type, declared or inferred, takes `Result<never, E>` (a function
 * given to `attempt` does), and in no `try` block that has a `catch` within that function (`throwOwners`).
 */
export function keelThrows(sf: ts.SourceFile, checker: ts.TypeChecker, ownerOf: Owner): number[] {
  const fns: { start: number; end: number; fn: ts.FunctionLikeDeclaration }[] = [];
  const caught: { start: number; end: number }[] = [];
  const throws = new Map<number, ts.ThrowStatement>();
  const span = (n: ts.Node): { start: number; end: number } => ({ start: n.getStart(sf), end: n.getEnd() });
  const visit = (n: ts.Node): void => {
    const fn = functionOf(n);
    if (fn !== undefined) fns.push({ ...span(fn), fn });
    if (ts.isTryStatement(n) && n.catchClause !== undefined) caught.push(span(n.tryBlock));
    if (ts.isThrowStatement(n)) throws.set(n.getStart(sf), n);
    ts.forEachChild(n, visit);
  };
  visit(sf);
  const out: number[] = [];
  for (const { at, owner } of throwOwners([...throws.keys()], fns, caught)) {
    const n = throws.get(at);
    if (n === undefined) continue;
    const thrown = checker.getTypeAtLocation(n.expression);
    if (!isKeelError(thrown, checker)) continue;
    if (givenToAttempt(owner.fn, checker, ownerOf) || takesFailure(owner.fn, thrown, checker)) out.push(at);
  }
  return out;
}
