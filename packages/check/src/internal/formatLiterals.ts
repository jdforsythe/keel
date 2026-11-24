import ts from "typescript";

/** Where `@keel/schema` declares `formatLiteral`: the source file, or its built declaration file. */
const DECLARED_IN = /\/schema\/(?:src|dist\/src)\/formatLiteral\.(?:d\.)?ts$/;

/** The format names `N` the type of a `formatLiteral` call carries: the keys of its `__format` brand. */
function namesOf(call: ts.CallExpression, checker: ts.TypeChecker): string[] {
  const returned = checker.getResolvedSignature(call)?.getReturnType();
  const brand = returned === undefined ? undefined : checker.getPropertyOfType(returned, "__format");
  if (brand === undefined) return [];
  const type = checker.getTypeOfSymbolAtLocation(brand, call);
  return checker.getPropertiesOfType(type).map((p) => p.getName());
}

/** Whether `call` calls `@keel/schema`'s `formatLiteral`, however it is imported (name, alias or namespace member). */
function isFormatLiteral(call: ts.CallExpression, checker: ts.TypeChecker): boolean {
  const callee = call.expression;
  const at = ts.isPropertyAccessExpression(callee) ? callee.name : callee;
  let sym = checker.getSymbolAtLocation(at);
  if (sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0) sym = checker.getAliasedSymbol(sym);
  return (sym?.declarations ?? []).some((d) => DECLARED_IN.test(d.getSourceFile().fileName.split("\\").join("/")));
}

/** The file declaring the value `format` names (an identifier, a namespace member, or a call's callee). */
function declaringFile(format: ts.Expression, checker: ts.TypeChecker): string | undefined {
  const target = ts.isCallExpression(format) ? format.expression : format;
  const at = ts.isPropertyAccessExpression(target) ? target.name : ts.isIdentifier(target) ? target : undefined;
  let sym = at === undefined ? undefined : checker.getSymbolAtLocation(at);
  if (sym !== undefined && (sym.flags & ts.SymbolFlags.Alias) !== 0) sym = checker.getAliasedSymbol(sym);
  return sym?.declarations?.[0]?.getSourceFile().fileName;
}

/**
 * The `formatLiteral` calls of `sf` (E1108, k.formats), however imported: the offsets of the `format` and `text`
 * arguments, the format names the call's type carries, and the literal text (`'..'`, `".."` or a template without
 * substitution), or `null` for any other argument, and the package declaring the `format` value (`ownerOf` of its
 * file). `judgeFormat` judges each against the registry.
 */
export function formatLiterals(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): { formatAt: number; textAt: number; names: string[]; text: string | null; owner: string | null }[] {
  const out: { formatAt: number; textAt: number; names: string[]; text: string | null; owner: string | null }[] = [];
  const visit = (n: ts.Node): void => {
    if (ts.isCallExpression(n) && n.arguments.length >= 2 && isFormatLiteral(n, checker)) {
      const [format, text] = n.arguments;
      const declared = format === undefined ? undefined : declaringFile(format, checker);
      if (format !== undefined && text !== undefined)
        out.push({
          formatAt: format.getStart(sf),
          textAt: text.getStart(sf),
          names: namesOf(n, checker),
          text: ts.isStringLiteral(text) || ts.isNoSubstitutionTemplateLiteral(text) ? text.text : null,
          owner: declared === undefined ? null : ownerOf(declared),
        });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
