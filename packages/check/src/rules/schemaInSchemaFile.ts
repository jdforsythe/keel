import type { Expression, Program } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isComponentFile } from "../internal/isComponentFile.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Local names bound to `s` from `@keel/schema`. */
function schemaNames(ast: Program): Set<string> {
  const out = new Set<string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/schema") continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (imported === "s") out.add(sp.local.name);
    }
  }
  return out;
}

/** True when `e` is a call chain rooted at `<s>.<factory>(...)` (`s.object(...)`, `s.string().optional()`). */
function isSchemaChain(e: Expression | null, names: ReadonlySet<string>): boolean {
  let cur: Expression | null = e;
  let called = false;
  while (cur !== null) {
    if (cur.type === "CallExpression") {
      called = true;
      cur = cur.callee;
    } else if (cur.type === "MemberExpression") cur = cur.object;
    else return called && cur.type === "Identifier" && names.has(cur.name);
  }
  return false;
}

/**
 * E1104 (k.schema): a top-level schema declaration (`const X = s.<factory>(...)`) outside a `*.schema.ts`
 * file. A component file's `Props` is exempt (k.component declares it beside the component), a PascalCase `.ts`
 * component's too (rfc:0068).
 */
export const schemaInSchemaFile: RuleDef = {
  code: "E1104",
  message: (f) => `schema ${str(f.data, "name")} declared outside a *.schema.ts file; move it there`,
  see: "k.schema",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || /\.schema\.[cm]?[jt]s$/.test(file.path)) return [];
    const names = schemaNames(ast);
    if (names.size === 0) return [];
    const component = isComponentFile(file.path, ast);
    const out: Finding[] = [];
    for (const st of ast.body) {
      const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
      if (decl?.type !== "VariableDeclaration") continue;
      for (const d of decl.declarations) {
        if (d.id.type !== "Identifier" || (component && d.id.name === "Props")) continue;
        if (isSchemaChain(d.init, names)) out.push(findingAt(file, d.id.start, { name: d.id.name }));
      }
    }
    return out;
  },
};
