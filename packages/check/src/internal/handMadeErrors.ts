import ts from "typescript";

/** Whether `t` is `@keel/schema`'s `KeelError`: its `code` declared there. */
function isKeelError(t: ts.Type, ownerOf: (fileName: string) => string | null): boolean {
  const code = t.getProperty("code");
  return (code?.declarations ?? []).some((d) => {
    for (let n: ts.Node = d; !ts.isSourceFile(n); n = n.parent)
      if (ts.isTypeAliasDeclaration(n))
        return n.name.text === "KeelError" && ownerOf(n.getSourceFile().fileName) === "@keel/schema";
    return false;
  });
}

/** The property names `o` writes, spreads aside. */
const writtenNames = (o: ts.ObjectLiteralExpression): string[] =>
  o.properties.flatMap((p) => {
    const name = ts.isSpreadAssignment(p) ? undefined : p.name;
    return name !== undefined && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) ? [name.text] : [];
  });

/** The fields of a `KeelError` a literal names when it is meant as one. */
const OWN: ReadonlySet<string> = new Set(["code", "message", "data"]);

/**
 * Whether literal `o`, of contextual type `t`, is meant as a `KeelError`: `t` is one; or `t` is a union, a member `o`
 * could be (an object type holding every name `o` writes) is a `KeelError`, and `o` names `code`, `message` or `data`
 * or each member it could be is a `KeelError`.
 */
function meantAsKeelError(
  o: ts.ObjectLiteralExpression,
  t: ts.Type,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): boolean {
  const own = (t.flags & ts.TypeFlags.TypeParameter) !== 0 ? (checker.getBaseConstraintOfType(t) ?? t) : t;
  if (!own.isUnion()) return isKeelError(own, ownerOf);
  const names = writtenNames(o);
  const could = own.types.filter(
    (u) =>
      (u.flags & (ts.TypeFlags.Object | ts.TypeFlags.Intersection)) !== 0 &&
      names.every((n) => u.getProperty(n) !== undefined),
  );
  const errors = could.filter((u) => meantAsKeelError(o, u, checker, ownerOf));
  if (errors.length === 0) return false;
  return names.some((n) => OWN.has(n)) || errors.length === could.length;
}

/**
 * The object literals of `sf` meant as a `KeelError` by their contextual type (k.expect Made errors, E1458 at the
 * literal): a `KeelError` is made by `X.make` or `X.causedBy` of an `s.error`, never written by hand. Of a union, the
 * members the literal could be decide.
 */
export function handMadeErrors(
  sf: ts.SourceFile,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
): ts.ObjectLiteralExpression[] {
  const out: ts.ObjectLiteralExpression[] = [];
  /** The literal's contextual type, and for a call's argument the parameter's declared type, before inference. */
  const expected = (n: ts.ObjectLiteralExpression): ts.Type[] => {
    const ct = checker.getContextualType(n);
    const own = ct === undefined ? [] : [ct];
    let at: ts.Node = n;
    while (ts.isParenthesizedExpression(at.parent)) at = at.parent;
    const call = at.parent;
    if (!ts.isCallExpression(call) && !ts.isNewExpression(call)) return own;
    const i = [...(call.arguments ?? [])].findIndex((a) => a === at);
    const param = i < 0 ? undefined : checker.getResolvedSignature(call)?.getDeclaration()?.parameters[i];
    return param === undefined ? own : [...own, checker.getTypeAtLocation(param)];
  };
  const walk = (n: ts.Node): void => {
    if (ts.isObjectLiteralExpression(n)) {
      if (expected(n).some((t) => meantAsKeelError(n, t, checker, ownerOf))) {
        out.push(n);
        return;
      }
    }
    ts.forEachChild(n, walk);
  };
  walk(sf);
  return out;
}
