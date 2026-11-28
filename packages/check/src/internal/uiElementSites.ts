import { type JSXOpeningElement, type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { UiSite } from "./UiSite.ts";
import { importTarget } from "./importTarget.ts";
import { parseFile } from "./parseFile.ts";

const UI = "@keel/ui";
const DEPTH = 8;

const exportedName = (n: { readonly type: string; readonly name?: string; readonly value?: unknown }): string =>
  typeof n.value === "string" ? n.value : (n.name ?? "");

/** Whether the file `at`'s export `name` is `@keel/ui`'s `target`, through named and star re-exports and imports. */
function exportsUi(
  project: readonly SourceFile[],
  at: SourceFile,
  name: string,
  target: string,
  depth: number,
): boolean {
  if (depth > DEPTH) return false;
  const body = parseFile(at).program.body;
  const imported = new Map<string, { readonly from: string; readonly name: string }>();
  for (const st of body)
    if (st.type === "ImportDeclaration")
      for (const sp of st.specifiers)
        if (sp.type === "ImportSpecifier")
          imported.set(sp.local.name, { from: st.source.value, name: exportedName(sp.imported) });
  const via = (from: string, local: string): boolean => {
    if (from === UI) return local === target;
    const file = importTarget(at.path, from, project);
    return file !== undefined && exportsUi(project, file, local, target, depth + 1);
  };
  for (const st of body) {
    if (st.type === "ExportNamedDeclaration" && st.exportKind !== "type")
      for (const sp of st.specifiers) {
        if (exportedName(sp.exported) !== name) continue;
        if (st.source !== null) return via(st.source.value, exportedName(sp.local));
        const hit = imported.get(exportedName(sp.local));
        return hit !== undefined && via(hit.from, hit.name);
      }
  }
  return body.some(
    (st) =>
      st.type === "ExportAllDeclaration" &&
      st.exported === null &&
      st.exportKind !== "type" &&
      via(st.source.value, name),
  );
}

/**
 * The elements and calls in `file` whose tag or callee is `@keel/ui`'s export `target`: a named import of it
 * (renamed or not), a member of a namespace import of `@keel/ui`, or either of those through project files that
 * re-export it (`export { X } from`, `export *`, an import re-exported) or a namespace import of such a file.
 */
export function uiElementSites(
  file: SourceFile,
  ast: Program,
  project: readonly SourceFile[],
  target: string,
): UiSite[] {
  const names = new Set<string>();
  const spaces = new Set<string>();
  const named = (from: string, imported: string): boolean => {
    if (from === UI) return imported === target;
    const at = importTarget(file.path, from, project);
    return at !== undefined && exportsUi(project, at, imported, target, 1);
  };
  const space = new Map<string, string>();
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportSpecifier" && sp.importKind !== "type") {
        if (named(st.source.value, exportedName(sp.imported))) names.add(sp.local.name);
      } else if (sp.type === "ImportNamespaceSpecifier") {
        if (st.source.value === UI) spaces.add(sp.local.name);
        else space.set(sp.local.name, st.source.value);
      }
    }
  }
  const member = (object: string, prop: string): boolean => {
    if (spaces.has(object)) return prop === target;
    const from = space.get(object);
    return from !== undefined && named(from, prop);
  };
  if (names.size === 0 && spaces.size === 0 && space.size === 0) return [];
  const out: UiSite[] = [];
  new Visitor({
    JSXOpeningElement: (n) => {
      const tag = n.name;
      if (tag.type === "JSXIdentifier" ? names.has(tag.name) : false) out.push({ at: n.start, element: n });
      else if (
        tag.type === "JSXMemberExpression" &&
        tag.object.type === "JSXIdentifier" &&
        member(tag.object.name, tag.property.name)
      )
        out.push({ at: n.start, element: n });
    },
    CallExpression: (n) => {
      const c = n.callee;
      if (c.type === "Identifier" ? names.has(c.name) : false) out.push({ at: c.start, element: undefined });
      else if (
        c.type === "MemberExpression" &&
        !c.computed &&
        c.object.type === "Identifier" &&
        c.property.type === "Identifier" &&
        member(c.object.name, c.property.name)
      )
        out.push({ at: c.start, element: undefined });
    },
  }).visit(ast);
  return out;
}
