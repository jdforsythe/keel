import { type CallExpression, type Expression, type ObjectExpression, type Program, Visitor } from "oxc-parser";
import type { SourceFile } from "../types/SourceFile.ts";
import type { ContractCall } from "./ContractCall.ts";
import type { ContractEntry } from "./ContractEntry.ts";
import { keyName } from "./keyName.ts";
import { localNames } from "./modules/localNames.ts";
import { namespaceNames } from "./modules/namespaceNames.ts";
import { propertyOf } from "./propertyOf.ts";

const FROM = "@keel/router/contract";

/** Whether `call` calls `contract` as imported from `@keel/router/contract` (named, aliased or through a namespace). */
function isContract(call: CallExpression, names: ReadonlySet<string>, spaces: ReadonlySet<string>): boolean {
  const c = call.callee;
  if (c.type === "Identifier") return names.has(c.name);
  return (
    c.type === "MemberExpression" &&
    !c.computed &&
    c.object.type === "Identifier" &&
    spaces.has(c.object.name) &&
    c.property.name === "contract"
  );
}

/** The entry kind its members tell: `method` an API entry, `layout` a layout, else a page (k.contract). */
function kindOf(obj: ObjectExpression | null): ContractEntry["kind"] {
  if (obj === null) return "page";
  if (propertyOf(obj, "method") !== null) return "api";
  return propertyOf(obj, "layout") !== null ? "layout" : "page";
}

/** Top-level `const` initializers of `program` by name, and the names exported as `export const`. */
function constsOf(program: Program): { consts: Map<string, Expression>; exported: Map<Expression, string> } {
  const consts = new Map<string, Expression>();
  const exported = new Map<Expression, string>();
  for (const st of program.body) {
    const decl = st.type === "ExportNamedDeclaration" ? st.declaration : st;
    if (decl?.type !== "VariableDeclaration" || decl.kind !== "const") continue;
    for (const d of decl.declarations) {
      if (d.id.type !== "Identifier" || d.init === null || d.init === undefined) continue;
      consts.set(d.id.name, d.init);
      if (st.type === "ExportNamedDeclaration") exported.set(d.init, d.id.name);
    }
  }
  return { consts, exported };
}

/**
 * Every `contract(id, entries)` call of `file` (k.contract), read without evaluating it: `entries` is the literal
 * argument or the literal a top-level `const` of the file holds. A spread or a computed key is skipped and marks the
 * call `partial`.
 */
export function contractCalls(file: SourceFile, program: Program): ContractCall[] {
  const names = localNames(program, "contract", FROM);
  const spaces = namespaceNames(program, FROM);
  if (names.size === 0 && spaces.size === 0) return [];
  const { consts, exported } = constsOf(program);
  const out: ContractCall[] = [];
  new Visitor({
    CallExpression: (call) => {
      if (!isContract(call, names, spaces)) return;
      const [first, second] = call.arguments;
      const id = first?.type === "Literal" && typeof first.value === "string" ? first.value : null;
      const held = second?.type === "Identifier" ? consts.get(second.name) : second;
      const entries = held?.type === "ObjectExpression" ? held : null;
      const list: ContractEntry[] = [];
      let partial = entries === null;
      for (const p of entries?.properties ?? []) {
        const key = p.type === "Property" ? keyName(p) : null;
        if (p.type !== "Property" || key === null) {
          partial = true;
          continue;
        }
        const obj = p.value.type === "ObjectExpression" ? p.value : null;
        list.push({ id: key, prop: p, obj, kind: kindOf(obj) });
      }
      out.push({ file, call, id, entries, list, exported: exported.get(call) ?? null, partial });
    },
  }).visit(program);
  return out;
}
