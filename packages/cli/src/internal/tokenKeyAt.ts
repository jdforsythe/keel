import ts from "typescript";

type Expr = ts.Expression;

/** `e` without the wrappers that leave its value as written: brackets, `as`, `satisfies`, `!` and a `defineTokens(...)` call. */
function unwrap(e: Expr, consts: ReadonlyMap<string, Expr>, seen: Set<string>): Expr {
  if (
    ts.isParenthesizedExpression(e) ||
    ts.isAsExpression(e) ||
    ts.isSatisfiesExpression(e) ||
    ts.isNonNullExpression(e)
  )
    return unwrap(e.expression, consts, seen);
  const first = ts.isCallExpression(e) ? e.arguments[0] : undefined;
  if (first !== undefined) return unwrap(first, consts, seen);
  if (ts.isIdentifier(e) && !seen.has(e.text)) {
    const init = consts.get(e.text);
    if (init !== undefined) return unwrap(init, consts, seen.add(e.text));
  }
  return e;
}

/** The text of a property's name when it is written as one: an identifier, a string or number, or `["..."]`. */
function nameOf(p: ts.ObjectLiteralElementLike): string | undefined {
  const n = p.name;
  if (n === undefined) return undefined;
  if (ts.isIdentifier(n) || ts.isStringLiteral(n) || ts.isNumericLiteral(n) || ts.isPrivateIdentifier(n)) return n.text;
  if (ts.isComputedPropertyName(n) && ts.isStringLiteralLike(n.expression)) return n.expression.text;
  return undefined;
}

/**
 * Where E1807 sits in `tokens.ts` for the issue `path` (k.themes Token errors): the first character of the key that
 * writes the path's last segment (a quoted key's opening quote); for a path written through a spread or from another
 * file, the `...` of the last spread in the deepest object literal of the file on the path; else the deepest key
 * written, or line 1, column 1. Lines and columns count from 1.
 */
export function tokenKeyAt(source: string, path: readonly string[]): { line: number; col: number } {
  const file = ts.createSourceFile("tokens.ts", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const consts = new Map<string, Expr>();
  let root: Expr | undefined;
  for (const st of file.statements) {
    if (!ts.isVariableStatement(st)) continue;
    const exported = st.modifiers?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword) === true;
    for (const d of st.declarationList.declarations) {
      if (!ts.isIdentifier(d.name) || d.initializer === undefined) continue;
      consts.set(d.name.text, d.initializer);
      if (exported && d.name.text === "tokens") root = d.initializer;
    }
  }
  const at = (pos: number): { line: number; col: number } => {
    const lc = file.getLineAndCharacterOfPosition(pos);
    return { line: lc.line + 1, col: lc.character + 1 };
  };
  let here = root === undefined ? undefined : unwrap(root, consts, new Set());
  let deepest: number | undefined;
  for (const segment of path) {
    if (here === undefined) break;
    if (ts.isArrayLiteralExpression(here)) {
      const item = /^\d+$/.test(segment) ? here.elements[Number(segment)] : undefined;
      if (item === undefined) break;
      deepest = item.getStart(file);
      here = unwrap(item, consts, new Set());
      continue;
    }
    if (!ts.isObjectLiteralExpression(here)) break;
    const props = here.properties;
    const prop = props.filter((p) => nameOf(p) === segment).at(-1);
    if (prop === undefined) {
      const spread = props.filter(ts.isSpreadAssignment).at(-1);
      return spread === undefined ? at(deepest ?? 0) : at(spread.getStart(file));
    }
    deepest = (prop.name ?? prop).getStart(file);
    here = ts.isPropertyAssignment(prop) ? unwrap(prop.initializer, consts, new Set()) : undefined;
  }
  return at(deepest ?? 0);
}
