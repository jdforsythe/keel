import ts from "typescript";

function isResult(t: ts.Type, checker: ts.TypeChecker): boolean {
  if (!t.isUnion()) return false;
  const hasOk = t.types.every((m) => checker.getPropertyOfType(m, "ok") !== undefined);
  const hasValue = t.types.some((m) => checker.getPropertyOfType(m, "value") !== undefined);
  const hasError = t.types.some((m) => checker.getPropertyOfType(m, "error") !== undefined);
  return hasOk && hasValue && hasError;
}

/**
 * E1453 (k.errors): offsets of expression statements whose value is a `Result` or `Promise<Result>`
 * (`void expr` is an explicit discard and is not reported).
 */
export function resultDiscards(sf: ts.SourceFile, checker: ts.TypeChecker): number[] {
  const out: number[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isExpressionStatement(n)) {
      let e: ts.Expression = n.expression;
      while (ts.isParenthesizedExpression(e) || ts.isAwaitExpression(e)) e = e.expression;
      if (ts.isCallExpression(e)) {
        const t = checker.getTypeAtLocation(n.expression);
        const awaited = checker.getAwaitedType(t) ?? t;
        if (isResult(awaited, checker)) out.push(n.getStart(sf));
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
