import { type ImportDeclaration, type JSXElement, type Program, Visitor } from "oxc-parser";
import type { Edit } from "../types/Edit.ts";

/** The `@keel/ui` import declaration and specifier that bind `local` to `ThemeSelect`, else undefined. */
function importOf(ast: Program, local: string): { decl: ImportDeclaration; index: number } | undefined {
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/ui") continue;
    const index = st.specifiers.findIndex(
      (sp) =>
        sp.type === "ImportSpecifier" &&
        sp.local.name === local &&
        (sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value) === "ThemeSelect",
    );
    if (index >= 0) return { decl: st, index };
  }
  return undefined;
}

/** The edit removing specifier `index` of `decl` and one comma beside it, or the whole declaration and its line end. */
function dropSpecifier(source: string, decl: ImportDeclaration, index: number): Edit {
  const all = decl.specifiers;
  const sp = all[index];
  if (all.length === 1 || sp === undefined) {
    const end = source[decl.end] === "\n" ? decl.end + 1 : decl.end;
    return { start: decl.start, end, text: "" };
  }
  const next = all[index + 1];
  const prev = all[index - 1];
  if (next !== undefined) return { start: sp.start, end: next.start, text: "" };
  return { start: prev?.end ?? sp.start, end: sp.end, text: "" };
}

/**
 * The E1816 fix for `needs a choice theme` (k.themes Fixes) at the JSX element whose opening `<` is at `at`: the element
 * deleted (a JSX child removed; elsewhere, as a return value or an argument, written `null`) and, when that was the
 * file's one use of its `ThemeSelect` import, that specifier, or the whole import declaration when it held no other.
 * Null when no JSX element opens at `at`.
 */
export function dropThemeSelect(source: string, ast: Program, at: number): Edit[] | null {
  let element: JSXElement | undefined;
  let child = false;
  const uses = new Map<string, number>();
  const imports = ast.body.filter((st) => st.type === "ImportDeclaration");
  const inImport = (offset: number): boolean => imports.some((d) => offset >= d.start && offset < d.end);
  const count = (name: string): void => {
    uses.set(name, (uses.get(name) ?? 0) + 1);
  };
  const children = (list: readonly { type: string; start: number }[]): void => {
    if (list.some((c) => c.type === "JSXElement" && c.start === at)) child = true;
  };
  new Visitor({
    JSXElement: (n) => {
      if (n.start === at) element = n;
      children(n.children);
    },
    JSXFragment: (n) => children(n.children),
    JSXOpeningElement: (n) => {
      if (n.name.type === "JSXIdentifier") count(n.name.name);
    },
    Identifier: (n) => {
      if (!inImport(n.start)) count(n.name);
    },
  }).visit(ast);
  if (element === undefined) return null;
  const edits: Edit[] = [{ start: element.start, end: element.end, text: child ? "" : "null" }];
  const name = element.openingElement.name;
  const found = name.type === "JSXIdentifier" ? importOf(ast, name.name) : undefined;
  if (found !== undefined && name.type === "JSXIdentifier" && uses.get(name.name) === 1)
    edits.push(dropSpecifier(source, found.decl, found.index));
  return edits;
}
