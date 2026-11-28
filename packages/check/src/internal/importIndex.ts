import { templatePattern } from "@keel/compiler/internal";
import { type ModuleExportName, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ImportEntry } from "./ImportEntry.ts";
import { parseFile } from "./parseFile.ts";
import { reachResolve } from "./reachResolve.ts";

const memo = new WeakMap<readonly SourceFile[], ReadonlyMap<string, readonly ImportEntry[]>>();
const nameOf = (n: ModuleExportName): string => (n.type === "Literal" ? n.value : n.name);

/**
 * For each file of `project`, how the project's files take its exports (`ImportEntry`), each specifier followed as
 * reach follows it (`reachResolve`, k.boundary Following), its query stripped; a template `import()` with a relative
 * head names every file its pattern matches. Read once per project.
 */
export function importIndex(project: readonly SourceFile[]): ReadonlyMap<string, readonly ImportEntry[]> {
  const hit = memo.get(project);
  if (hit !== undefined) return hit;
  const known = new Set(project.map((f) => f.path));
  const resolve = reachResolve(project, "", known);
  const out = new Map<string, ImportEntry[]>();
  const add = (target: string | undefined, entry: ImportEntry): void => {
    if (target !== undefined) out.set(target, [...(out.get(target) ?? []), entry]);
  };
  for (const from of project) {
    const parsed = parseFile(from);
    const to = (spec: string): string | undefined => resolve(from.path, spec.split("?")[0] ?? spec);
    for (const st of parsed.program.body) {
      if (st.type === "ImportDeclaration" && st.importKind !== "type") {
        const target = to(st.source.value);
        for (const sp of st.specifiers)
          if (sp.type === "ImportNamespaceSpecifier") add(target, { kind: "namespace", from, local: sp.local.name });
          else if (sp.type === "ImportDefaultSpecifier")
            add(target, { kind: "import", from, imported: "default", local: sp.local.name });
          else if (sp.importKind !== "type")
            add(target, { kind: "import", from, imported: nameOf(sp.imported), local: sp.local.name });
      } else if (st.type === "ExportAllDeclaration" && st.exportKind !== "type")
        add(to(st.source.value), { kind: st.exported === null ? "star" : "starAs", from });
      else if (st.type === "ExportNamedDeclaration" && st.source !== null && st.exportKind !== "type") {
        const target = to(st.source.value);
        for (const sp of st.specifiers)
          if (sp.exportKind !== "type")
            add(target, { kind: "reexport", from, imported: nameOf(sp.local), exported: nameOf(sp.exported) });
      }
    }
    new Visitor({
      ImportExpression: (n) => {
        const x = n.source;
        if (x.type === "Literal" && typeof x.value === "string") add(to(x.value), { kind: "dynamic", from });
        else if (x.type === "TemplateLiteral" && x.expressions.length === 0)
          add(to(x.quasis[0]?.value.cooked ?? ""), { kind: "dynamic", from });
        else if (x.type === "TemplateLiteral") {
          const pattern = templatePattern(from.path, x);
          for (const p of pattern === undefined ? [] : known)
            if (pattern?.test(p) === true) add(p, { kind: "dynamic", from });
        }
      },
    }).visit(parsed.program);
  }
  memo.set(project, out);
  return out;
}
