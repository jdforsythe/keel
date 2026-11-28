import ts from "typescript";

/** Whether a declaration is `@keel/ui`'s element `name` (its source, or the package's built declaration). */
const fromUi = (d: ts.Declaration, name: string): boolean => {
  const file = d.getSourceFile().fileName.split("\\").join("/");
  return new RegExp(`/(?:ui/(?:src|dist/src)/elements|@keel/ui/(?:src|dist/src)/elements)/${name}\\.(?:d\\.)?ts$`).test(
    file,
  );
};

/**
 * E1814 and E1816 (k.schemes Checks): offsets in `sf` of each JSX element (its `<`) and call (its callee) whose tag or
 * callee the checker resolves, through imports, re-exports and namespace members, to `@keel/ui`'s element `name`
 * (`SchemeSelect`, `ThemeSelect`, `Box`).
 */
export function uiElementReads(sf: ts.SourceFile, checker: ts.TypeChecker, name: string): number[] {
  const out: number[] = [];
  const isUi = (e: ts.Node): boolean => {
    let sym = checker.getSymbolAtLocation(ts.isPropertyAccessExpression(e) ? e.name : e);
    for (let i = 0; sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0 && i < 16; i++)
      sym = checker.getAliasedSymbol(sym);
    return sym?.getName() === name && (sym.declarations ?? []).some((d) => fromUi(d, name));
  };
  const visit = (n: ts.Node): void => {
    if ((ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) && isUi(n.tagName)) out.push(n.getStart(sf));
    else if (ts.isCallExpression(n) && isUi(n.expression)) out.push(n.expression.getStart(sf));
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
