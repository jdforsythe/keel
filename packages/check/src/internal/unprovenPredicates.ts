import ts from "typescript";

/** What a claimed type holds that no check proves (k.unsafe Type predicates). */
type What = "a call signature" | "a type parameter";

const bare = (e: ts.Expression): ts.Expression => (ts.isParenthesizedExpression(e) ? bare(e.expression) : e);

/** `n` when it is a function with a body whose return type is a type predicate naming a type, else `undefined`. */
function predicateOf(n: ts.Node): { fn: ts.FunctionLikeDeclaration; pred: ts.TypePredicateNode } | undefined {
  const fn =
    ts.isFunctionDeclaration(n) || ts.isFunctionExpression(n) || ts.isArrowFunction(n) || ts.isMethodDeclaration(n)
      ? n
      : undefined;
  const pred = fn?.type;
  if (fn === undefined || fn.body === undefined || pred === undefined || !ts.isTypePredicateNode(pred))
    return undefined;
  return pred.type === undefined ? undefined : { fn, pred };
}

/** The `return` statements of `fn`'s own body, nested functions aside. */
function ownReturns(body: ts.Node): ts.ReturnStatement[] {
  const out: ts.ReturnStatement[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isFunctionLike(n)) return;
    if (ts.isReturnStatement(n)) out.push(n);
    ts.forEachChild(n, walk);
  };
  ts.forEachChild(body, walk);
  return out;
}

/** Whether `e` is `Symbol.for('<text>')`. */
function isSymbolFor(e: ts.Expression): boolean {
  const c = bare(e);
  if (!ts.isCallExpression(c) || c.arguments.length !== 1) return false;
  const arg = c.arguments[0];
  const callee = bare(c.expression);
  return (
    arg !== undefined &&
    ts.isStringLiteralLike(arg) &&
    ts.isPropertyAccessExpression(callee) &&
    callee.name.text === "for" &&
    ts.isIdentifier(callee.expression) &&
    callee.expression.text === "Symbol"
  );
}

/**
 * E1762 (k.unsafe Type predicates): the type predicates and assertion functions of `sf` (declarations, function
 * expressions, arrow functions and methods with a body) whose claimed type, read through its properties, index
 * signatures, array and tuple elements, union and intersection members and type arguments to any depth, holds a call
 * or construct signature with a parameter or a return type other than `void`, `unknown` or `any`, or a type parameter
 * of the predicate itself. A key guard is none: every `return` of the body (or the expression body) is, or is a `&&`
 * chain ending in, `B.has(x)` with `B` a module-level `const` `WeakSet` of this file that it does not export, or
 * `Object.hasOwn(x, K)` with `K` `Symbol.for('...')` or a name bound, through imports, to a `const` initialized with
 * one; `x` the predicate's parameter. Each finding is at the predicate's first character, its message
 * `type predicate claims <what> no check proves; move it into unsafe()`.
 */
export function unprovenPredicates(sf: ts.SourceFile, checker: ts.TypeChecker): { at: number; message: string }[] {
  const out: { at: number; message: string }[] = [];
  const resolved = (s: ts.Symbol): ts.Symbol =>
    (s.flags & ts.SymbolFlags.Alias) !== 0 ? checker.getAliasedSymbol(s) : s;

  const claimed = (fn: ts.FunctionLikeDeclaration, t: ts.Type): What | undefined => {
    const seen = new Set<ts.Type>();
    const walk = (type: ts.Type): What | undefined => {
      if (seen.has(type)) return undefined;
      seen.add(type);
      if ((type.flags & ts.TypeFlags.TypeParameter) !== 0) {
        const own = (type.getSymbol()?.declarations ?? []).some(
          (d) => ts.isTypeParameterDeclaration(d) && d.parent === fn,
        );
        return own ? "a type parameter" : undefined;
      }
      for (const a of type.aliasTypeArguments ?? []) {
        const w = walk(a);
        if (w !== undefined) return w;
      }
      if (type.isUnionOrIntersection()) {
        for (const m of type.types) {
          const w = walk(m);
          if (w !== undefined) return w;
        }
        return undefined;
      }
      if ((type.flags & ts.TypeFlags.Object) === 0) return undefined;
      const elements = checker.isArrayType(type) || checker.isTupleType(type);
      if (!elements) {
        for (const kind of [ts.SignatureKind.Call, ts.SignatureKind.Construct]) {
          for (const sig of checker.getSignaturesOfType(type, kind)) {
            if (sig.getParameters().length > 0) return "a call signature";
            const r = checker.getReturnTypeOfSignature(sig);
            if ((r.flags & (ts.TypeFlags.Void | ts.TypeFlags.Unknown | ts.TypeFlags.Any)) === 0)
              return "a call signature";
          }
        }
        for (const p of checker.getPropertiesOfType(type)) {
          const w = walk(checker.getTypeOfSymbol(p));
          if (w !== undefined) return w;
        }
      }
      for (const info of checker.getIndexInfosOfType(type)) {
        const w = walk(info.type);
        if (w !== undefined) return w;
      }
      return undefined;
    };
    return walk(t);
  };

  /** Whether `e` is `Symbol.for(...)`, or a name bound through imports to a `const` initialized with it. */
  const isKey = (e: ts.Expression): boolean => {
    const k = bare(e);
    if (isSymbolFor(k)) return true;
    const sym = ts.isIdentifier(k) ? checker.getSymbolAtLocation(k) : undefined;
    const decl = sym === undefined ? undefined : resolved(sym).valueDeclaration;
    if (decl === undefined || !ts.isVariableDeclaration(decl) || decl.initializer === undefined) return false;
    return (decl.parent.flags & ts.NodeFlags.Const) !== 0 && isSymbolFor(decl.initializer);
  };

  /** Whether `b` names a module-level `const` `WeakSet` of `sf` that `sf` does not export. */
  const isMarkSet = (b: ts.Identifier): boolean => {
    const sym = checker.getSymbolAtLocation(b);
    const decl = sym?.valueDeclaration;
    if (sym === undefined || decl === undefined || !ts.isVariableDeclaration(decl)) return false;
    if (decl.getSourceFile() !== sf || (decl.parent.flags & ts.NodeFlags.Const) === 0) return false;
    const st = decl.parent.parent;
    if (!ts.isVariableStatement(st) || st.parent !== sf) return false;
    if ((st.modifiers ?? []).some((m) => m.kind === ts.SyntaxKind.ExportKeyword)) return false;
    const exported = sf.statements.some(
      (s) =>
        (ts.isExportAssignment(s) && ts.isIdentifier(s.expression) && s.expression.text === b.text) ||
        (ts.isExportDeclaration(s) &&
          s.moduleSpecifier === undefined &&
          s.exportClause !== undefined &&
          ts.isNamedExports(s.exportClause) &&
          s.exportClause.elements.some((el) => (el.propertyName ?? el.name).getText(sf) === b.text)),
    );
    if (exported) return false;
    const init = decl.initializer === undefined ? undefined : bare(decl.initializer);
    return (
      init !== undefined &&
      ts.isNewExpression(init) &&
      ts.isIdentifier(init.expression) &&
      init.expression.text === "WeakSet" &&
      (checker.getSymbolAtLocation(init.expression)?.declarations ?? []).some(
        (d) => d.getSourceFile().isDeclarationFile,
      )
    );
  };

  /** Whether `e` is a key guard on the parameter `param`. */
  const isKeyGuard = (e: ts.Expression, param: ts.Symbol): boolean => {
    let end = bare(e);
    while (ts.isBinaryExpression(end) && end.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken)
      end = bare(end.right);
    if (!ts.isCallExpression(end)) return false;
    const callee = bare(end.expression);
    if (!ts.isPropertyAccessExpression(callee) || !ts.isIdentifier(callee.expression)) return false;
    const x = end.arguments[0];
    const onParam = x !== undefined && ts.isIdentifier(bare(x)) && checker.getSymbolAtLocation(bare(x)) === param;
    if (!onParam) return false;
    if (callee.name.text === "has") return end.arguments.length === 1 && isMarkSet(callee.expression);
    const key = end.arguments[1];
    return (
      callee.name.text === "hasOwn" &&
      callee.expression.text === "Object" &&
      end.arguments.length === 2 &&
      key !== undefined &&
      isKey(key)
    );
  };

  const keyGuarded = (fn: ts.FunctionLikeDeclaration, pred: ts.TypePredicateNode): boolean => {
    const name = pred.parameterName;
    if (!ts.isIdentifier(name) || fn.body === undefined) return false;
    const p = fn.parameters.find((q) => ts.isIdentifier(q.name) && q.name.text === name.text);
    const param = p === undefined ? undefined : checker.getSymbolAtLocation(p.name);
    if (param === undefined) return false;
    if (!ts.isBlock(fn.body)) return isKeyGuard(fn.body, param);
    const returns = ownReturns(fn.body);
    return returns.length > 0 && returns.every((r) => r.expression !== undefined && isKeyGuard(r.expression, param));
  };

  const visit = (n: ts.Node): void => {
    const found = predicateOf(n);
    if (found !== undefined && found.pred.type !== undefined) {
      const what = claimed(found.fn, checker.getTypeFromTypeNode(found.pred.type));
      if (what !== undefined && !keyGuarded(found.fn, found.pred))
        out.push({
          at: found.pred.getStart(sf),
          message: `type predicate claims ${what} no check proves; move it into unsafe()`,
        });
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
  return out;
}
