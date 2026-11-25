import fs from "node:fs";
import path from "node:path";
import { type ModuleExportName, parseSync } from "oxc-parser";

/** How many re-exports `definingFile` follows before it gives up. */
const HOPS = 8;
const nameOf = (n: ModuleExportName): string => (n.type === "Literal" ? n.value : n.name);

/** The file a relative specifier `spec` names from `from`: as written, then with a code extension or as a folder's `index.ts`. */
function target(from: string, spec: string): string | undefined {
  if (!spec.startsWith(".")) return undefined;
  const at = path.resolve(path.dirname(from), spec);
  return [at, `${at}.ts`, `${at}.tsx`, `${at}.js`, path.join(at, "index.ts")].find((f) =>
    fs.statSync(f, { throwIfNoEntry: false })?.isFile(),
  );
}

/**
 * The file that defines export `name` of the file `file` (absolute), followed through its relative re-exports
 * (`export { x } from`, `export { x as name } from`, `export *`, and `export { x }` of an imported `x`): the file itself
 * when it declares the export. Undefined when the export is not found or the chain leaves the files it can read.
 */
export function definingFile(file: string, name: string, hops = 0): string | undefined {
  if (hops > HOPS) return undefined;
  let source: string;
  try {
    source = fs.readFileSync(file, "utf8");
  } catch {
    return undefined;
  }
  const { program } = parseSync(file, source, { sourceType: "module" });
  const via = (spec: string, as: string): string | undefined => {
    const next = target(file, spec);
    return next === undefined ? undefined : definingFile(next, as, hops + 1);
  };
  /** A local binding `local`: imported (followed to its file) or declared here. */
  const local = (id: string): string | undefined => {
    for (const st of program.body)
      if (st.type === "ImportDeclaration")
        for (const sp of st.specifiers)
          if (sp.local.name === id)
            return sp.type === "ImportSpecifier"
              ? via(st.source.value, nameOf(sp.imported))
              : sp.type === "ImportDefaultSpecifier"
                ? via(st.source.value, "default")
                : undefined;
    return file;
  };
  for (const st of program.body) {
    if (st.type === "ExportDefaultDeclaration" && name === "default") return file;
    if (st.type === "ExportAllDeclaration" && st.exported === null && name !== "default") {
      const hit = via(st.source.value, name);
      if (hit !== undefined) return hit;
    }
    if (st.type !== "ExportNamedDeclaration") continue;
    const d = st.declaration;
    if (d !== null && d !== undefined) {
      const declares =
        ((d.type === "FunctionDeclaration" || d.type === "ClassDeclaration") && d.id?.name === name) ||
        (d.type === "VariableDeclaration" &&
          d.declarations.some((v) => v.id.type === "Identifier" && v.id.name === name));
      if (declares) return file;
      continue;
    }
    for (const sp of st.specifiers) {
      if (nameOf(sp.exported) !== name) continue;
      return st.source === null ? local(nameOf(sp.local)) : via(st.source.value, nameOf(sp.local));
    }
  }
  return undefined;
}
