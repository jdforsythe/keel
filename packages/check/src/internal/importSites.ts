import ts from "typescript";

/**
 * The module specifiers through which TypeScript loads other files from `sf`, in source order, each with the start of
 * its statement or expression: import and export declarations (type-only too), `import x = require()`, a literal
 * `import()`, an `import("…")` type, and a `declare module "…"` augmentation in a module file.
 */
export function importSites(sf: ts.SourceFile): { at: number; spec: ts.StringLiteralLike }[] {
  const out: { at: number; spec: ts.StringLiteralLike }[] = [];
  const augments = ts.isExternalModule(sf);
  const visit = (node: ts.Node): void => {
    const at = (): number => node.getStart(sf);
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier !== undefined) {
      if (ts.isStringLiteralLike(node.moduleSpecifier)) out.push({ at: at(), spec: node.moduleSpecifier });
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      out.push({ at: at(), spec: node.moduleReference.expression });
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      const first = node.arguments[0];
      if (first !== undefined && ts.isStringLiteralLike(first)) out.push({ at: at(), spec: first });
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument) &&
      ts.isStringLiteralLike(node.argument.literal)
    ) {
      out.push({ at: at(), spec: node.argument.literal });
    } else if (augments && ts.isModuleDeclaration(node) && ts.isStringLiteral(node.name)) {
      out.push({ at: at(), spec: node.name });
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(sf, visit);
  return out;
}
