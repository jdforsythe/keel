import { type Node, type Program, Visitor } from "oxc-parser";
import { localNames } from "./modules/localNames.ts";
import { namespaceNames } from "./modules/namespaceNames.ts";

const FROM = "@keel/router/contract";

const nameOf = (n: { readonly type: string; readonly name?: string; readonly value?: unknown }): string | null =>
  n.type === "Identifier" && typeof n.name === "string" ? n.name : typeof n.value === "string" ? n.value : null;

/**
 * Offsets in `program` where `contract` of `@keel/router/contract` is reached other than by a direct call of its
 * import (`contract(...)`, `c(...)` for `import { contract as c }`, `ns.contract(...)` for `import * as ns`), which
 * is all the contract readers follow (k.contract Rules E1513): a use of the import as a value (`const mk = contract`,
 * an argument, `{ contract }`, `export { contract }`), a namespace import used other than as `ns.<name>` with
 * `ns.contract` called, a value re-export of `contract` (by name or `*`), and a dynamic `import()` of the entry.
 */
export function contractEscapes(program: Program): readonly number[] {
  const names = localNames(program, "contract", FROM);
  const spaces = namespaceNames(program, FROM);
  const out = new Set<number>();
  const allowed = new Set<Node>();
  const callees = new Set<Node>();
  new Visitor({
    ImportDeclaration: (st) => {
      for (const sp of st.specifiers) {
        allowed.add(sp.local);
        if (sp.type === "ImportSpecifier") allowed.add(sp.imported);
      }
    },
    ExportNamedDeclaration: (st) => {
      if (st.exportKind === "type" || (st.source !== null && st.source.value !== FROM)) return;
      for (const sp of st.specifiers) {
        allowed.add(sp.exported);
        if (st.source === null) continue;
        allowed.add(sp.local);
        if (sp.exportKind !== "type" && nameOf(sp.local) === "contract") out.add(sp.start);
      }
    },
    ExportAllDeclaration: (st) => {
      if (st.source.value === FROM && st.exportKind !== "type") out.add(st.start);
    },
    ImportExpression: (e) => {
      if (e.source.type === "Literal" && e.source.value === FROM) out.add(e.start);
    },
    CallExpression: (call) => {
      callees.add(call.callee);
    },
    MemberExpression: (m) => {
      if (!m.computed) allowed.add(m.property);
      if (m.object.type !== "Identifier" || !spaces.has(m.object.name)) return;
      if (m.computed || (m.property.type === "Identifier" && m.property.name === "contract" && !callees.has(m)))
        out.add(m.start);
      allowed.add(m.object);
    },
    Property: (p) => {
      if (!p.computed && !p.shorthand) allowed.add(p.key);
    },
    MethodDefinition: (p) => {
      if (!p.computed) allowed.add(p.key);
    },
    PropertyDefinition: (p) => {
      if (!p.computed) allowed.add(p.key);
    },
    TSTypeQuery: (q) => {
      allowed.add(q.exprName);
    },
    Identifier: (id) => {
      if (allowed.has(id) || callees.has(id)) return;
      if (names.has(id.name) || spaces.has(id.name)) out.add(id.start);
    },
  }).visit(program);
  return [...out].sort((a, b) => a - b);
}
