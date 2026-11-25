import ts from "typescript";

/** The local names and namespaces under which `source` imports `Host` from `@keel/ui` (value imports). */
function hostNames(file: ts.SourceFile): { names: Set<string>; spaces: Set<string> } {
  const names = new Set<string>();
  const spaces = new Set<string>();
  for (const st of file.statements) {
    if (!ts.isImportDeclaration(st) || !ts.isStringLiteral(st.moduleSpecifier)) continue;
    const clause = st.importClause;
    if (st.moduleSpecifier.text !== "@keel/ui" || clause === undefined || clause.isTypeOnly) continue;
    const bindings = clause.namedBindings;
    if (bindings !== undefined && ts.isNamespaceImport(bindings)) spaces.add(bindings.name.text);
    if (bindings !== undefined && ts.isNamedImports(bindings))
      for (const el of bindings.elements)
        if (!el.isTypeOnly && (el.propertyName ?? el.name).text === "Host") names.add(el.name.text);
  }
  return { names, spaces };
}

/**
 * The host elements a file holds (k.host-element Ledger): its `<Host>` elements and `Host(...)` calls of `@keel/ui`'s
 * `Host`, by a named import (aliases followed) or a namespace import's member. 0 for a file that does not import it.
 */
export function countHosts(path: string, source: string): number {
  if (!source.includes("Host") || !source.includes("@keel/ui")) return 0;
  const file = ts.createSourceFile(
    path,
    source,
    ts.ScriptTarget.Latest,
    false,
    path.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const { names, spaces } = hostNames(file);
  if (names.size === 0 && spaces.size === 0) return 0;
  const isHost = (e: ts.Node): boolean =>
    ts.isIdentifier(e)
      ? names.has(e.text)
      : ts.isPropertyAccessExpression(e) &&
        ts.isIdentifier(e.expression) &&
        spaces.has(e.expression.text) &&
        e.name.text === "Host";
  let n = 0;
  const visit = (node: ts.Node): void => {
    if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) && isHost(node.tagName)) n++;
    else if (ts.isCallExpression(node) && isHost(node.expression)) n++;
    ts.forEachChild(node, visit);
  };
  visit(file);
  return n;
}
