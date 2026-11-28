import ts from "typescript";

/** Whether `d` lies in the type alias `name` that `@keel/schema` declares. */
function inSchemaAlias(d: ts.Node, name: string, ownerOf: (fileName: string) => string | null): boolean {
  for (let n: ts.Node = d; !ts.isSourceFile(n); n = n.parent)
    if (ts.isTypeAliasDeclaration(n))
      return n.name.text === name && ownerOf(n.getSourceFile().fileName) === "@keel/schema";
  return false;
}

/**
 * Whether type `t` is a keel `Result`, a `PromiseLike` of one, or a union holding either (k.attempt Values, E1459). A
 * member is a keel `Result` when its `ok` property is declared in `@keel/schema`'s `Result`; a type parameter, `any` and
 * `unknown` are none (the run time refuses those).
 */
export function holdsKeelResult(
  t: ts.Type,
  checker: ts.TypeChecker,
  ownerOf: (fileName: string) => string | null,
  depth = 0,
): boolean {
  if (depth > 4) return false;
  if ((t.flags & (ts.TypeFlags.TypeParameter | ts.TypeFlags.Any | ts.TypeFlags.Unknown)) !== 0) return false;
  if (t.isUnion()) return t.types.some((u) => holdsKeelResult(u, checker, ownerOf, depth + 1));
  const ok = t.getProperty("ok");
  if ((ok?.declarations ?? []).some((d) => inSchemaAlias(d, "Result", ownerOf))) return true;
  if (t.getProperty("then") === undefined) return false;
  const awaited = checker.getAwaitedType(t);
  return awaited !== undefined && awaited !== t && holdsKeelResult(awaited, checker, ownerOf, depth + 1);
}
