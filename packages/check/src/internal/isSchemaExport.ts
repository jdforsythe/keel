import ts from "typescript";

/**
 * Whether the callee `e` resolves, through import aliases and namespace members, to the export `name` of
 * `@keel/schema` (`ownerOf` names the package a declaration's file belongs to).
 */
export function isSchemaExport(
  e: ts.Expression,
  name: string,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): boolean {
  const at = ts.isPropertyAccessExpression(e) ? e.name : e;
  const sym = checker.getSymbolAtLocation(at);
  if (sym === undefined) return false;
  const s = (sym.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(sym) : sym;
  if (s.getName() !== name) return false;
  return (s.declarations ?? []).some((d) => ownerOf(d.getSourceFile().fileName) === "@keel/schema");
}
