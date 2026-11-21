import ts from "typescript";

const FLOW: ReadonlySet<string> = new Set(["If", "For", "Match", "Case", "Boundary"]);

const bare = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? bare(e.expression) : e);

/** The first parameter's name of the innermost capitalized function around `n` (a component), if it is a name. */
function propsOf(n: ts.Node): string | undefined {
  for (let p: ts.Node | undefined = n.parent; p !== undefined; p = p.parent) {
    if (!ts.isFunctionLike(p)) continue;
    const named = p.name ?? (ts.isVariableDeclaration(p.parent) ? p.parent.name : undefined);
    if (named === undefined || !ts.isIdentifier(named) || !/^[A-Z]/.test(named.text)) continue;
    const first = p.parameters[0]?.name;
    return first !== undefined && ts.isIdentifier(first) ? first.text : undefined;
  }
  return undefined;
}

/** A slot call as the compiler places it (k.place Prop calls): `children()`, `x.children()`, `slots.x()`, `props.x()`. */
function isSlotCall(e: ts.Expression, props: string | undefined): boolean {
  if (ts.isBinaryExpression(e) && e.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken)
    return isSlotCall(bare(e.left), props);
  if (!ts.isCallExpression(e)) return false;
  const c = e.expression;
  if (ts.isIdentifier(c)) return c.text === "children";
  if (!ts.isPropertyAccessExpression(c)) return false;
  if (c.name.text === "children") return true;
  return ts.isIdentifier(c.expression) && (c.expression.text === "slots" || c.expression.text === props);
}

/**
 * E1406 (k.place): JSX child expressions the compiler binds as text (not a literal, JSX or a slot call, and not the
 * content of a control-flow intrinsic) whose type is or may hold a `Node` or is a function. `any` and `unknown` are
 * skipped. `fix` is the offset to append `()` at (a prop member or a name whose function type needs no argument), else -1.
 */
export function textNodes(sf: ts.SourceFile, checker: ts.TypeChecker): { at: number; fix: number }[] {
  const out: { at: number; fix: number }[] = [];
  const nodeSym = checker.resolveName("Node", undefined, ts.SymbolFlags.Type, false);
  const node = nodeSym === undefined ? undefined : checker.getDeclaredTypeOfSymbol(nodeSym);
  const holds = (t: ts.Type, depth: number): boolean => {
    if (
      (t.flags &
        (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Null | ts.TypeFlags.Undefined | ts.TypeFlags.Void)) !==
      0
    )
      return false;
    if (t.isUnion()) return t.types.some((u) => holds(u, depth));
    if (t.getCallSignatures().length > 0) return true;
    const item = checker.isArrayType(t) ? checker.getIndexTypeOfType(t, ts.IndexKind.Number) : undefined;
    if (item !== undefined) return depth < 4 && holds(item, depth + 1);
    return node !== undefined && (t.flags & ts.TypeFlags.Object) !== 0 && checker.isTypeAssignableTo(t, node);
  };
  const noArgs = (t: ts.Type): boolean =>
    t
      .getCallSignatures()
      .some((s) =>
        s.parameters.every((p) =>
          (p.declarations ?? []).every((d) => ts.isParameter(d) && checker.isOptionalParameter(d)),
        ),
      );
  const visit = (n: ts.Node): void => {
    if (
      ts.isJsxExpression(n) &&
      n.expression !== undefined &&
      (ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent))
    ) {
      const tag = ts.isJsxElement(n.parent) ? n.parent.openingElement.tagName.getText(sf) : "";
      const e = bare(n.expression);
      const skip =
        FLOW.has(tag) ||
        ts.isStringLiteralLike(e) ||
        ts.isNumericLiteral(e) ||
        ts.isJsxElement(e) ||
        ts.isJsxSelfClosingElement(e) ||
        ts.isJsxFragment(e) ||
        isSlotCall(e, propsOf(n));
      const t = skip ? undefined : checker.getTypeAtLocation(e);
      if (t !== undefined && holds(t, 0)) {
        const named = ts.isIdentifier(e) || (ts.isPropertyAccessExpression(e) && ts.isIdentifier(e.expression));
        out.push({ at: e.getStart(sf), fix: named && noArgs(t) ? e.getEnd() : -1 });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
