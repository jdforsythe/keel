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

/** How the value below `links[at]` is used, past wrappers: a callee, a name an export specifier or default binds, else other. */
function useOf(links: readonly RefLink[], at: number): "call" | "export" | "other" {
  for (let i = at; i >= 0; i--) {
    const link = links[i];
    if (link === undefined) return "other";
    if (WRAPPERS.has(link.node.type) && link.key === "expression") continue;
    if (link.node.type === "CallExpression" && link.key === "callee") return "call";
    const bound =
      (link.node.type === "ExportSpecifier" && link.key === "local") ||
      (link.node.type === "ExportDefaultDeclaration" && link.key === "declaration");
    return bound ? "export" : "other";
  }
  return "other";
}

/**
 * The uses of a store maker in `file` that check cannot follow (k.leave E1107), each at its identifier with the name
 * as written: a maker's name, or a namespace member naming one, other than as a callee, an export specifier or
 * `export default` (a `const` alias, an argument, an array element); and a namespace of a library holding a maker
 * other than through a non-computed member (destructured, a computed member, passed whole). Also each call (`call`)
 * of a name imported from a library holding a maker or a `store` use (`storing`), or a member of its namespace, that
 * no function of the library's files answers (an entry no file holds, an export that is no function): check cannot
 * tell it makes no store.
 */
export function makerValueUses(
  file: SourceFile,
  program: Program,
  project: readonly SourceFile[],
  makers: ReadonlyMap<string, Maker>,
  storing: ReadonlySet<string>,
  modules: readonly ModuleInfo[],
): { readonly at: number; readonly name: string; readonly call: boolean }[] {
  const out: { at: number; name: string; call: boolean }[] = [];
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
          if (useOf(ref.links, ref.links.length - 1) === "other")
            out.push({ at: ref.ident.start, name: local, call: false });
      continue;
    }
    const ns = followRef({ type: "Identifier", name: local, start: 0, end: 0 }, file, project);
    if (ns === null || ns === "global" || !("package" in ns)) continue;
    const pkg = ns.package
      .split("/")
      .slice(0, ns.package.startsWith("@") ? 2 : 1)
      .join("/");
    if (!makerPkgs.has(pkg) && !storing.has(pkg)) continue;
    if (ns.name !== "*") {
      for (const ref of refs)
        if (useOf(ref.links, ref.links.length - 1) === "call")
          out.push({ at: ref.ident.start, name: local, call: true });
      continue;
    }
    const entry = fileOf(file, ns.package);
    const keyOf = (name: string): string | undefined => {
      const hit = entry === undefined ? undefined : exportedFunction(name, entry, fileOf);
      return hit === undefined ? undefined : fnKeyOf(hit.file, hit.fn);
    };
    for (const ref of refs) {
      const top = ref.links.length - 1;
      const up = ref.links[top];
      const member = up?.node.type === "MemberExpression" && up.key === "object" ? up.node : undefined;
      const property = member?.property;
      if (member !== undefined && member.computed !== true && isAstNode(property)) {
        const name = property.name;
        if (typeof name !== "string") continue;
        const key = keyOf(name);
        const use = useOf(ref.links, top - 1);
        if (key === undefined && use === "call")
          out.push({ at: ref.ident.start, name: `${local}.${name}`, call: true });
        else if (key !== undefined && makers.has(key) && use === "other")
          out.push({ at: ref.ident.start, name: `${local}.${name}`, call: false });
      } else if (makerPkgs.has(pkg)) out.push({ at: ref.ident.start, name: local, call: false });
    }
  }
  return out.sort((a, b) => a.at - b.at);
}
