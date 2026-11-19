import type { ArrowFunctionExpression, Expression, Function as Fn, Program } from "oxc-parser";

/** True when `n` (a type annotation subtree) holds the identifier `Props`: `Props`, `Infer<typeof Props>`, ... */
function namesProps(n: unknown): boolean {
  if (typeof n !== "object" || n === null) return false;
  if ("type" in n && n.type === "Identifier" && "name" in n && n.name === "Props") return true;
  const kids: unknown[] = Object.values(n);
  return kids.some(namesProps);
}

/** True when `f` is a function whose first parameter's type annotation names `Props`. */
function takesProps(f: Fn | ArrowFunctionExpression | Expression | null | undefined): boolean {
  if (f?.type !== "FunctionDeclaration" && f?.type !== "FunctionExpression" && f?.type !== "ArrowFunctionExpression")
    return false;
  const p = f.params[0];
  const id = p?.type === "AssignmentPattern" ? p.left : p;
  return id !== undefined && "typeAnnotation" in id && namesProps(id.typeAnnotation);
}

/** The default export of a plain `.ts` file is a function taking `Props`: inline, or a top-level function or const it names. */
function defaultTakesProps(ast: Program): boolean {
  for (const st of ast.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (d.type === "FunctionDeclaration") return takesProps(d);
    if (d.type !== "Identifier") return d.type === "ArrowFunctionExpression" && takesProps(d);
    for (const s of ast.body) {
      const decl = s.type === "ExportNamedDeclaration" ? s.declaration : s;
      if (decl?.type === "FunctionDeclaration" && decl.id?.name === d.name) return takesProps(decl);
      if (decl?.type === "VariableDeclaration")
        for (const v of decl.declarations)
          if (v.id.type === "Identifier" && v.id.name === d.name) return takesProps(v.init);
    }
  }
  return false;
}

/**
 * A component file (k.component, rfc:0068), the one definition E1752 and E1104 share: a PascalCase `.tsx`/`.jsx` with a
 * default export, or a PascalCase `.ts`/`.js` whose default export is a function whose first parameter's type names
 * `Props`. Only such a file may also export `Props` and `uses`; `Config.ts` exporting an object is not one.
 */
export function isComponentFile(path: string, ast: Program): boolean {
  const base = path.split("/").pop() ?? path;
  if (/^[A-Z][A-Za-z0-9]*\.[jt]sx$/.test(base)) return ast.body.some((s) => s.type === "ExportDefaultDeclaration");
  return /^[A-Z][A-Za-z0-9]*\.[cm]?[jt]s$/.test(base) && defaultTakesProps(ast);
}
