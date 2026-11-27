import ts from "typescript";

/** Whether `t`, or a member of the union `t` is, is `@keel/schema`'s `KeelError`: its `code` declared there. */
function isKeelError(t: ts.Type, checker: ts.TypeChecker, ownerOf: (fileName: string) => string | null): boolean {
  const own = (t.flags & ts.TypeFlags.TypeParameter) !== 0 ? (checker.getBaseConstraintOfType(t) ?? t) : t;
  if (own.isUnion()) return own.types.some((u) => isKeelError(u, checker, ownerOf));
  const code = own.getProperty("code");
  return (code?.declarations ?? []).some((d) => {
    for (let n: ts.Node = d; !ts.isSourceFile(n); n = n.parent)
      if (ts.isTypeAliasDeclaration(n))
        return n.name.text === "KeelError" && ownerOf(n.getSourceFile().fileName) === "@keel/schema";
    return false;
  });
}

/**
 * The object literals of `sf` whose contextual type is a `KeelError` (k.expect Made errors, E1458 at the literal): a
 * `KeelError` is made by `X.make` or `X.causedBy` of an `s.error`, never written by hand.
 */
export function handMadeErrors(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): ts.ObjectLiteralExpression[] {
  const out: ts.ObjectLiteralExpression[] = [];
  /** The literal's contextual type, and for a call's argument the parameter's declared type, before inference. */
  const expected = (n: ts.ObjectLiteralExpression): ts.Type[] => {
    const ct = checker.getContextualType(n);
    const own = ct === undefined ? [] : [ct];
    let at: ts.Node = n;
    while (ts.isParenthesizedExpression(at.parent)) at = at.parent;
    const call = at.parent;
    if (!ts.isCallExpression(call) && !ts.isNewExpression(call)) return own;
    const i = [...(call.arguments ?? [])].findIndex((a) => a === at);
    const param = i < 0 ? undefined : checker.getResolvedSignature(call)?.getDeclaration()?.parameters[i];
    return param === undefined ? own : [...own, checker.getTypeAtLocation(param)];
  };
  const walk = (n: ts.Node): void => {
    if (ts.isObjectLiteralExpression(n)) {
      if (expected(n).some((t) => isKeelError(t, checker, ownerOf))) {
        out.push(n);
        return;
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}
