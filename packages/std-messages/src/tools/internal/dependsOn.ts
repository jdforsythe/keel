import type { SourceFile } from "@keel/check";
import type { Expression } from "oxc-parser";
import { PKG } from "./PKG.ts";
import { keyOf } from "./keyOf.ts";
import { parsed } from "./parsed.ts";
import { unwrap } from "./unwrap.ts";

const MANIFEST = "module.ts";

/** The literal strings of a `module.ts` manifest's `deps` (k.module): a default-exported object or call over one. */
function depsOf(manifest: SourceFile): readonly string[] {
  for (const st of parsed(manifest)?.body ?? []) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (d.type === "FunctionDeclaration" || d.type === "ClassDeclaration" || d.type === "TSInterfaceDeclaration")
      return [];
    const x: Expression = unwrap(d);
    const arg = x.type === "CallExpression" ? x.arguments[0] : x;
    const obj = arg === undefined || arg.type === "SpreadElement" ? undefined : unwrap(arg);
    if (obj?.type !== "ObjectExpression") return [];
    const deps = obj.properties.find((p) => keyOf(p) === "deps");
    const list = deps?.type === "Property" ? unwrap(deps.value) : undefined;
    if (list?.type !== "ArrayExpression") return [];
    return list.elements.flatMap((el) => (el?.type === "Literal" && typeof el.value === "string" ? [el.value] : []));
  }
  return [];
}

/**
 * Whether the module holding `path` lists `@keel/std-messages` in its `deps`: the `module.ts` in `project` whose
 * directory is the longest prefix of `path`. A file outside every module depends on nothing.
 */
export function dependsOn(path: string, project: readonly SourceFile[]): boolean {
  let best: SourceFile | undefined;
  for (const f of project) {
    if (f.path !== MANIFEST && !f.path.endsWith(`/${MANIFEST}`)) continue;
    const root = f.path.slice(0, f.path.length - MANIFEST.length);
    if (path.startsWith(root) && (best === undefined || f.path.length > best.path.length)) best = f;
  }
  return best !== undefined && depsOf(best).includes(PKG);
}
