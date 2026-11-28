import ts from "typescript";
import { holdsKeelResult } from "./holdsKeelResult.ts";

/**
 * The first type arguments of the written `Result<T, E>` references in `sf` (`Result` of `@keel/schema`, by symbol)
 * whose `T` holds a keel `Result` (`holdsKeelResult`, E1459 at the type argument).
 */
export function nestedResultTypes(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): ts.TypeNode[] {
  const out: ts.TypeNode[] = [];
  const isResult = (name: ts.EntityName): boolean => {
    const at = ts.isQualifiedName(name) ? name.right : name;
    const sym = checker.getSymbolAtLocation(at);
    if (sym === undefined) return false;
    const s = (sym.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(sym) : sym;
    if (s.getName() !== "Result") return false;
    return (s.declarations ?? []).some(
      (d) => ts.isTypeAliasDeclaration(d) && ownerOf(d.getSourceFile().fileName) === "@keel/schema",
    );
  };
  const walk = (n: ts.Node): void => {
    if (ts.isTypeReferenceNode(n) && n.typeArguments !== undefined && isResult(n.typeName)) {
      const first = n.typeArguments[0];
      if (first !== undefined && holdsKeelResult(checker.getTypeFromTypeNode(first), checker, ownerOf)) out.push(first);
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}
