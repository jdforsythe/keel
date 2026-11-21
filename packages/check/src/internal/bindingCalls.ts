import { type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { BindingCall } from "./BindingCall.ts";
import type { BindingEntry } from "./BindingEntry.ts";
import { keyName } from "./keyName.ts";
import { localNames } from "./modules/localNames.ts";
import { namespaceNames } from "./modules/namespaceNames.ts";

const FROM = "@keel/router";

/** The specifier each named import's local name comes from. */
function importsOf(program: Program): Map<string, string> {
  const out = new Map<string, string>();
  for (const st of program.body)
    if (st.type === "ImportDeclaration")
      for (const sp of st.specifiers) if (sp.type === "ImportSpecifier") out.set(sp.local.name, st.source.value);
  return out;
}

/**
 * Every `manifest(contract, binding)` call of `file` (k.contract Binding), read without evaluating it, `manifest`
 * imported from `@keel/router` (named, aliased or through a namespace). A spread or a computed key of the binding is
 * skipped and marks the call `partial`.
 */
export function bindingCalls(file: SourceFile, program: Program): BindingCall[] {
  const names = localNames(program, "manifest", FROM);
  const spaces = namespaceNames(program, FROM);
  if (names.size === 0 && spaces.size === 0) return [];
  const imports = importsOf(program);
  const out: BindingCall[] = [];
  new Visitor({
    CallExpression: (call) => {
      const c = call.callee;
      const hit =
        (c.type === "Identifier" && names.has(c.name)) ||
        (c.type === "MemberExpression" &&
          !c.computed &&
          c.object.type === "Identifier" &&
          spaces.has(c.object.name) &&
          c.property.name === "manifest");
      if (!hit) return;
      const [first, second] = call.arguments;
      const contract = first?.type === "Identifier" ? first.name : null;
      const binding = second?.type === "ObjectExpression" ? second : null;
      const list: BindingEntry[] = [];
      let partial = binding === null;
      for (const p of binding?.properties ?? []) {
        const key = p.type === "Property" ? keyName(p) : null;
        if (p.type !== "Property" || key === null) {
          partial = true;
          continue;
        }
        list.push({ id: key, prop: p, obj: p.value.type === "ObjectExpression" ? p.value : null });
      }
      const source = contract === null ? null : (imports.get(contract) ?? null);
      out.push({ file, call, contract, source, binding, list, partial });
    },
  }).visit(program);
  return out;
}
