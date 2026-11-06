import type { Analysis } from "./Analysis.ts";

/** `@keel/ui` base elements (k.ui Base elements). */
const BASE: ReadonlySet<string> = new Set([
  "Box",
  "Text",
  "Heading",
  "Button",
  "Link",
  "Image",
  "Input",
  "TextArea",
  "Select",
  "Checkbox",
]);

/** Local JSX name -> base element name, for value imports of base elements from `@keel/ui` in this file. */
export function uiBaseElements(a: Analysis): Map<string, string> {
  const out = new Map<string, string>();
  for (const i of a.imports) {
    if (i.source.value !== "@keel/ui" || i.importKind === "type") continue;
    for (const s of i.specifiers) {
      if (s.type !== "ImportSpecifier" || s.importKind === "type") continue;
      const imported = s.imported.type === "Identifier" ? s.imported.name : s.imported.value;
      if (BASE.has(imported)) out.set(s.local.name, imported);
    }
  }
  return out;
}
