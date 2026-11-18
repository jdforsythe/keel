import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { type Expression, type Program, Visitor } from "oxc-parser";
import { BASE_ELEMENTS } from "../internal/BASE_ELEMENTS.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { num } from "../internal/num.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const BASE = BASE_ELEMENTS;
/** k.runtime control flow that builds its rows or branch at the call (`anchored`), so it is eager like an element. */
const CONTROL: ReadonlySet<string> = new Set(["For", "If", "Match"]);
/** The names each source exports that make a node at the call. */
const MAKERS: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ["@keel/ui", BASE],
  ["@keel/runtime-dom", CONTROL],
]);
/** Alias and nesting links followed before giving up. */
const MAX_DEPTH = 16;

/** Value imports of makers: named (local name, offset, export) and namespaces (local, offset, its makers). */
function makerImports(ast: Program): {
  named: [string, number, string][];
  spaces: [string, number, ReadonlySet<string>][];
} {
  const named: [string, number, string][] = [];
  const spaces: [string, number, ReadonlySet<string>][] = [];
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    const set = MAKERS.get(st.source.value);
    if (set === undefined) continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") spaces.push([sp.local.name, sp.local.start, set]);
      if (sp.type !== "ImportSpecifier" || sp.importKind === "type") continue;
      const imported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      if (set.has(imported)) named.push([sp.local.name, sp.local.start, imported]);
    }
  }
  return { named, spaces };
}

/**
 * E1808 (k.ui, rfc:0069): a base element call whose `children` is made eagerly: a base element or `For`/`If`/`Match`
 * call (k.runtime builds rows at the call), JSX, a conditional or array holding one, or a same-file binding whose
 * initializer is one. The child is made before its parent, so at resume it claims the parent's server node (E1253)
 * and the island re-renders. Callees resolve through the rfc:0053 resolver: renamed imports, `const` aliases,
 * `ui.Box` of a namespace import and `const { Box } = ui` count; a local `Box` does not. The props may be a `const`
 * object literal. Fix: wrap an inline value in `() => `; a binding has none (a thunk returning it is still eager).
 * Not followed (backlog 0201): `o.f` members, array destructuring, IIFEs.
 */
export const noEagerChild: RuleDef = {
  code: "E1808",
  message: (f) => `${str(f.data, "base")} children made before it; pass a thunk: children: () => ...`,
  explain:
    "A base element's child made before it claims the parent's server node at resume (E1253), so the island re-renders. Pass children as a thunk.",
  see: "k.ui",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const { named, spaces } = makerImports(ast);
    if (named.length === 0 && spaces.length === 0) return [];
    const g = globalRefs(ast);
    // `const { Box, Input: I } = ui` of a namespace import: each local is that export.
    new Visitor({
      VariableDeclarator: (d) => {
        if (d.init === null || d.id.type !== "ObjectPattern") return;
        const o = g.initOf(d.init);
        const space =
          o.type === "Identifier" ? spaces.find(([n, at]) => n === o.name && g.sameBinding(n, o.start, at)) : undefined;
        if (space === undefined) return;
        for (const p of d.id.properties) {
          if (p.type !== "Property" || p.value.type !== "Identifier") continue;
          const key = p.computed ? null : p.key.type === "Identifier" ? p.key.name : null;
          if (key !== null && space[2].has(key)) named.push([p.value.name, p.value.start, key]);
        }
      },
    }).visit(ast);
    /** The maker export `callee` denotes, or null. */
    const makerOf = (callee: Expression): string | null => {
      const x = g.initOf(callee);
      if (x.type === "Identifier")
        return named.find(([n, at]) => n === x.name && g.sameBinding(n, x.start, at))?.[2] ?? null;
      if (x.type !== "MemberExpression" || x.computed) return null;
      const o = g.initOf(x.object);
      const key = x.property.name;
      return o.type === "Identifier" &&
        spaces.some(([n, at, set]) => n === o.name && set.has(key) && g.sameBinding(n, o.start, at))
        ? key
        : null;
    };
    const eager = (e: Expression, depth: number): boolean => {
      if (depth > MAX_DEPTH) return false;
      const x = unwrapExpression(e);
      switch (x.type) {
        case "JSXElement":
        case "JSXFragment":
          return true;
        case "CallExpression":
          return makerOf(x.callee) !== null;
        case "ArrayExpression":
          return x.elements.some((el) => el !== null && el.type !== "SpreadElement" && eager(el, depth + 1));
        case "ConditionalExpression":
          return eager(x.consequent, depth + 1) || eager(x.alternate, depth + 1);
        case "LogicalExpression":
          return eager(x.left, depth + 1) || eager(x.right, depth + 1);
        case "Identifier": {
          const init = g.initOf(x);
          return init !== x && eager(init, depth + 1);
        }
        default:
          return false;
      }
    };
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const first = n.arguments[0];
        const arg = first === undefined || first.type === "SpreadElement" ? null : g.initOf(first);
        if (arg === null || arg.type !== "ObjectExpression") return;
        const prop = propertyOf(arg, "children");
        if (prop === null || !eager(prop.value, 0)) return;
        const base = makerOf(n.callee);
        if (base === null || !BASE.has(base)) return;
        const inline = !prop.shorthand && unwrapExpression(prop.value).type !== "Identifier";
        out.push(findingAt(file, prop.value.start, { base, at: inline ? prop.value.start : -1 }));
      },
    }).visit(ast);
    return out;
  },
  fix: (f) => {
    const at = num(f.data, "at", -1);
    return at < 0 ? null : [{ start: at, end: at, text: "() => " }];
  },
};
