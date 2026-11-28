import fs from "node:fs";
import path from "node:path";
import { parseSync } from "oxc-parser";
import { patternNames } from "./patternNames.ts";

/** `spec` from `file` as a file on disk: as written, then with a code extension or as a folder's `index.ts`. */
function fileOf(file: string, spec: string): string | undefined {
  const at = path.resolve(path.dirname(file), spec);
  return [at, `${at}.ts`, `${at}.tsx`, `${at}.js`, path.join(at, "index.ts")].find((f) =>
    fs.statSync(f, { throwIfNoEntry: false })?.isFile(),
  );
}

/**
 * The value export names of the module at `file` (k.boundary Browser builds): declarations and specifiers, `default`,
 * `export * as x`, and the names `export * from './y'` gives, followed through relative files; `export type` and type
 * declarations are dropped. A file that does not parse gives none.
 */
export function exportNames(file: string, seen: Set<string> = new Set()): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const { program, errors } = parseSync(file, fs.readFileSync(file, "utf8"), { sourceType: "module" });
  if (errors.length > 0) return [];
  const out = new Set<string>();
  const nameOf = (n: { type: string; name?: string; value?: unknown }): string =>
    n.type === "Literal" ? String(n.value) : (n.name ?? "");
  for (const s of program.body) {
    if (s.type === "ExportDefaultDeclaration" && s.declaration.type !== "TSInterfaceDeclaration") out.add("default");
    if (s.type === "ExportAllDeclaration" && s.exportKind !== "type") {
      if (s.exported !== null) out.add(nameOf(s.exported));
      const next = s.source.value.startsWith(".") ? fileOf(file, s.source.value) : undefined;
      for (const n of next === undefined ? [] : exportNames(next, seen)) if (n !== "default") out.add(n);
    }
    if (s.type !== "ExportNamedDeclaration" || s.exportKind === "type") continue;
    for (const sp of s.specifiers) if (sp.exportKind !== "type") out.add(nameOf(sp.exported));
    const d = s.declaration;
    if (d?.type === "VariableDeclaration")
      for (const v of d.declarations) for (const n of patternNames(v.id)) out.add(n);
    if (
      (d?.type === "FunctionDeclaration" || d?.type === "ClassDeclaration" || d?.type === "TSEnumDeclaration") &&
      d.id
    )
      out.add(d.id.name);
  }
  return [...out];
}
