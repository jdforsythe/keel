import { type ModuleExportName, parseSync } from "oxc-parser";

/** A file that imports `@keel/ctx` (or a subpath of it) and names `register`. */
const CTX = /\bfrom\s*["']@keel\/ctx(?:\/[\w./-]+)?["']/;
const REGISTER = /\bregister\b/;
const nameOf = (n: ModuleExportName): string => (n.type === "Literal" ? n.value : n.name);
/** Each `from '<spec>'` of a source, read as text. */
const FROM = /\bfrom\s*["']([^"'\n]+)["']/g;

/**
 * Whether `source` (the file `file`) may register a capability (k.data Dev, k.server-deps Registration through a
 * library): it imports `@keel/ctx` and names `register`, or it imports or re-exports a name from a specifier for which
 * `library(spec, name)` holds, the name's defining file in a library registering (`libraryRegisters`); a namespace
 * import or `export *` asks for the name `*`, and so does each `from '<spec>'` of a file that does not parse. A file that does is evaluated again only with the whole server graph, so
 * the registry it registers with starts empty.
 */
export function registersCapability(
  source: string,
  library: (spec: string, name: string) => boolean = () => false,
  file = "file.ts",
): boolean {
  if (CTX.test(source) && REGISTER.test(source)) return true;
  const { program, errors } = parseSync(file, source, { sourceType: "module" });
  // A file that does not parse (an edit in progress) counts when it names a specifier any export of which registers.
  if (errors.length > 0) return [...source.matchAll(FROM)].some((m) => library(m[1] ?? "", "*"));
  for (const st of program.body) {
    if (st.type === "ImportDeclaration" && st.importKind !== "type") {
      for (const sp of st.specifiers) {
        if (sp.type === "ImportSpecifier" && sp.importKind === "type") continue;
        const name =
          sp.type === "ImportSpecifier" ? nameOf(sp.imported) : sp.type === "ImportDefaultSpecifier" ? "default" : "*";
        if (library(st.source.value, name)) return true;
      }
    } else if (st.type === "ExportNamedDeclaration" && st.source !== null && st.exportKind !== "type") {
      for (const sp of st.specifiers)
        if (sp.exportKind !== "type" && library(st.source.value, nameOf(sp.local))) return true;
    } else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type" && library(st.source.value, "*"))
      return true;
  }
  return false;
}
