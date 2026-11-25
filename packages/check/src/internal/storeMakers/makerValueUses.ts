import type { Program } from "oxc-parser";
import type { SourceFile } from "../../types/SourceFile.ts";
import type { RefLink } from "../RefLink.ts";
import { followRef } from "../followRef.ts";
import { exportedFunction } from "../functionRead/exportedFunction.ts";
import { fileOfIn } from "../functionRead/fileOfIn.ts";
import { localFunction } from "../functionRead/localFunction.ts";
import { isAstNode } from "../isAstNode.ts";
import type { ModuleInfo } from "../modules/ModuleInfo.ts";
import { moduleOf } from "../modules/moduleOf.ts";
import { projectLibraries } from "../projectLibraries.ts";
import { topRefs } from "../topRefs.ts";
import type { Maker } from "./Maker.ts";
import { fnKeyOf } from "./fnKeyOf.ts";

const WRAPPERS = new Set(["ParenthesizedExpression", "TSAsExpression", "TSSatisfiesExpression", "TSNonNullExpression"]);

/** Whether the value below `links[at]` is, past wrappers, a callee or a name an export specifier or default binds. */
function followed(links: readonly RefLink[], at: number): boolean {
  for (let i = at; i >= 0; i--) {
    const link = links[i];
    if (link === undefined) return false;
    if (WRAPPERS.has(link.node.type) && link.key === "expression") continue;
    return (
      (link.node.type === "CallExpression" && link.key === "callee") ||
      (link.node.type === "ExportSpecifier" && link.key === "local") ||
      (link.node.type === "ExportDefaultDeclaration" && link.key === "declaration")
    );
  }
  return false;
}

/**
 * The uses of a store maker in `file` that check cannot follow (k.leave E1107), each at its identifier with the name
 * as written: a maker's name, or a namespace member naming one, other than as a callee, an export specifier or
 * `export default` (a `const` alias, an argument, an array element); and a namespace of a library holding a maker
 * other than through a non-computed member (destructured, a computed member, passed whole).
 */
export function makerValueUses(
  file: SourceFile,
  program: Program,
  project: readonly SourceFile[],
  makers: ReadonlyMap<string, Maker>,
  modules: readonly ModuleInfo[],
): { readonly at: number; readonly name: string }[] {
  const out: { at: number; name: string }[] = [];
  const fileOf = fileOfIn(project, projectLibraries.get(project)?.entries);
  const makerPkgs = new Set<string>();
  for (const key of makers.keys()) {
    const m = moduleOf(key.slice(0, key.lastIndexOf(":")), modules);
    if (m !== undefined) makerPkgs.add(m.key);
  }
  for (const [local, refs] of topRefs(program)) {
    const fn = localFunction(local, file, fileOf);
    if (fn !== undefined) {
      if (makers.has(fnKeyOf(fn.file, fn.fn)))
        for (const ref of refs)
          if (!followed(ref.links, ref.links.length - 1)) out.push({ at: ref.ident.start, name: local });
      continue;
    }
    const ns = followRef({ type: "Identifier", name: local, start: 0, end: 0 }, file, project);
    if (ns === null || ns === "global" || !("package" in ns) || ns.name !== "*" || !makerPkgs.has(ns.package)) continue;
    const entry = fileOf(file, ns.package);
    const isMaker = (name: string): boolean => {
      const hit = entry === undefined ? undefined : exportedFunction(name, entry, fileOf);
      return hit !== undefined && makers.has(fnKeyOf(hit.file, hit.fn));
    };
    for (const ref of refs) {
      const top = ref.links.length - 1;
      const up = ref.links[top];
      const member = up?.node.type === "MemberExpression" && up.key === "object" ? up.node : undefined;
      const property = member?.property;
      if (member !== undefined && member.computed !== true && isAstNode(property)) {
        const name = property.name;
        if (typeof name === "string" && isMaker(name) && !followed(ref.links, top - 1))
          out.push({ at: ref.ident.start, name: `${local}.${name}` });
      } else out.push({ at: ref.ident.start, name: local });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
