import ts from "typescript";

const bindingNames = (name: ts.BindingName, out: Set<string>): void => {
  if (ts.isIdentifier(name)) out.add(name.text);
  else for (const el of name.elements) if (ts.isBindingElement(el)) bindingNames(el.name, out);
};

const isFunctionLike = (n: ts.Node): n is ts.FunctionLikeDeclaration =>
  ts.isFunctionDeclaration(n) ||
  ts.isFunctionExpression(n) ||
  ts.isArrowFunction(n) ||
  ts.isMethodDeclaration(n) ||
  ts.isConstructorDeclaration(n) ||
  ts.isGetAccessorDeclaration(n) ||
  ts.isSetAccessorDeclaration(n);

/** The `var` declarations of a function body, not those of the functions and classes inside it. */
const hoisted = (n: ts.Node, out: Set<string>): void => {
  if (isFunctionLike(n) || ts.isClassLike(n)) return;
  if (ts.isVariableDeclarationList(n) && (n.flags & ts.NodeFlags.BlockScoped) === 0)
    for (const d of n.declarations) bindingNames(d.name, out);
  ts.forEachChild(n, (k) => hoisted(k, out));
};

const statementNames = (statements: readonly ts.Statement[], out: Set<string>): void => {
  for (const st of statements) {
    if (ts.isVariableStatement(st)) for (const d of st.declarationList.declarations) bindingNames(d.name, out);
    else if (
      (ts.isFunctionDeclaration(st) || ts.isClassDeclaration(st) || ts.isEnumDeclaration(st)) &&
      st.name !== undefined
    )
      out.add(st.name.text);
    else if (ts.isModuleDeclaration(st) && ts.isIdentifier(st.name)) out.add(st.name.text);
  }
};

/** The names a scope node declares for its own body: parameters, hoisted `var`s, block-level declarations, loop and catch variables. */
const declared = (n: ts.Node): Set<string> => {
  const out = new Set<string>();
  if (isFunctionLike(n)) {
    for (const p of n.parameters) bindingNames(p.name, out);
    if (ts.isFunctionExpression(n) && n.name !== undefined) out.add(n.name.text);
    if (n.body !== undefined) hoisted(n.body, out);
  } else if (ts.isClassExpression(n) && n.name !== undefined) out.add(n.name.text);
  else if (ts.isBlock(n) || ts.isModuleBlock(n)) statementNames(n.statements, out);
  else if (ts.isCaseBlock(n)) for (const c of n.clauses) statementNames(c.statements, out);
  else if (
    (ts.isForStatement(n) || ts.isForInStatement(n) || ts.isForOfStatement(n)) &&
    n.initializer !== undefined &&
    ts.isVariableDeclarationList(n.initializer)
  )
    for (const d of n.initializer.declarations) bindingNames(d.name, out);
  else if (ts.isCatchClause(n) && n.variableDeclaration !== undefined) bindingNames(n.variableDeclaration.name, out);
  return out;
};

/**
 * Whether the reference `id` resolves to a local declaration (a parameter, `var`, `let`, `const`, function, class including a class expression's own name, enum, namespace, loop
 * or catch variable of an enclosing scope below the file) instead of a binding of the file's top level, such as an
 * import. Scopes are read from the syntax only.
 */
export function shadowed(id: ts.Identifier): boolean {
  for (let n: ts.Node | undefined = id.parent; n !== undefined && !ts.isSourceFile(n); n = n.parent)
    if (declared(n).has(id.text)) return true;
  return false;
}
