import ts from "typescript";

/** Whether a declaration is `@keel/ui`'s `SchemeSelect` (its source, or the package's built declaration). */
const fromUi = (d: ts.Declaration): boolean => {
  const file = d.getSourceFile().fileName.split("\\").join("/");
  return /\/(?:ui\/(?:src|dist\/src)\/elements|@keel\/ui\/(?:src|dist\/src)\/elements)\/SchemeSelect\.(?:d\.)?ts$/.test(
    file,
  );
};

/**
 * E1814 (k.schemes Checks): offsets in `sf` of each JSX element (its `<`) and call (its callee) whose tag or callee the
 * checker resolves, through imports, re-exports and namespace members, to `@keel/ui`'s `SchemeSelect`.
 */
export function schemeSelectReads(sf: ts.SourceFile, checker: ts.TypeChecker): number[] {
  const out: number[] = [];
  const isSelect = (e: ts.Node): boolean => {
    let sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(e) ? e.name : e);
    for (let i = 0; sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0 && i < 16; i++)
      sym = checker.getAliasedSymbol(sym);
    return sym?.getName() === "SchemeSelect" && (sym.declarations ?? []).some(fromUi);
  };
  const visit = (n: ts.Node): void => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && isSelect(n.tagName)) out.push(n.getStart(sf));
    else if (ts.isCallExpression(n) && isSelect(n.expression)) out.push(n.expression.getStart(sf));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
