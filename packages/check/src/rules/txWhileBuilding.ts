import { globalRefs, unwrapExpression } from "@keel/compiler/internal";
import { type JSXAttributeValue, type JSXChild, type Program, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isComponentFile } from "../internal/isComponentFile.ts";
import { localNames } from "../internal/modules/localNames.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

type Span = { readonly start: number; readonly end: number };

/** k.component Build: the control-flow components whose function child runs while the component builds. */
const BUILD_CHILDREN: ReadonlySet<string> = new Set(["For", "If", "Match", "Case", "Boundary"]);

const FUNCTIONS: ReadonlySet<string> = new Set([
  "FunctionDeclaration",
  "FunctionExpression",
  "ArrowFunctionExpression",
]);

/** The span of the default export's function: inline, or the top-level function or const function it names. */
function componentSpan(ast: Program): Span | null {
  for (const st of ast.body) {
    if (st.type !== "ExportDefaultDeclaration") continue;
    const d = st.declaration;
    if (FUNCTIONS.has(d.type)) return { start: d.start, end: d.end };
    if (d.type !== "Identifier") return null;
    for (const s of ast.body) {
      const decl = s.type === "ExportNamedDeclaration" ? s.declaration : s;
      if (decl?.type === "FunctionDeclaration" && decl.id?.name === d.name) return { start: decl.start, end: decl.end };
      if (decl?.type !== "VariableDeclaration") continue;
      for (const v of decl.declarations) {
        if (v.id.type !== "Identifier" || v.id.name !== d.name || v.init === null) continue;
        const init = unwrapExpression(v.init);
        return FUNCTIONS.has(init.type) ? { start: init.start, end: init.end } : null;
      }
    }
  }
  return null;
}

/**
 * E1304 (k.store): a `tx` call from `@keel/store` in a component file that runs while the component builds: every
 * function enclosing it, up to the default-exported component function, is that function or a function child of a
 * `For`, `If`, `Match`, `Case` or `Boundary` element (a JSX child or its `children` attribute). A `tx` in any other
 * nested function (an event handler, an `effect` callback, a helper) is none, and a call is not followed. The write
 * throws E1201 at run time. No fix: creating the store with the data as `initial` is the author's edit.
 */
export const txWhileBuilding: RuleDef = {
  code: "E1304",
  message: () => "tx while the component builds; create the store with the data as initial",
  see: "k.store",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || !isComponentFile(file.path, ast)) return [];
    const txs = localNames(ast, "tx", "@keel/store");
    if (txs.size === 0) return [];
    const component = componentSpan(ast);
    if (component === null) return [];
    const g = globalRefs(ast);
    const fns: Span[] = [];
    const build: Span[] = [component];
    const calls: number[] = [];
    const fnChild = (e: JSXChild | JSXAttributeValue | null): void => {
      if (e?.type !== "JSXExpressionContainer" || e.expression.type === "JSXEmptyExpression") return;
      const x = unwrapExpression(e.expression);
      if (x.type === "ArrowFunctionExpression" || x.type === "FunctionExpression")
        build.push({ start: x.start, end: x.end });
    };
    const fn = (n: Span): void => {
      fns.push({ start: n.start, end: n.end });
    };
    new Visitor({
      FunctionDeclaration: fn,
      FunctionExpression: fn,
      ArrowFunctionExpression: fn,
      JSXElement: (n) => {
        const name = n.openingElement.name;
        if (name.type !== "JSXIdentifier" || !BUILD_CHILDREN.has(name.name)) return;
        for (const c of n.children) fnChild(c);
        for (const a of n.openingElement.attributes)
          if (a.type === "JSXAttribute" && a.name.type === "JSXIdentifier" && a.name.name === "children")
            fnChild(a.value);
      },
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type === "Identifier" && txs.has(c.name) && g.sameBinding(c.name, ast.start, c.start))
          calls.push(n.start);
      },
    }).visit(ast);
    const inside = (s: Span, at: number): boolean => at >= s.start && at < s.end;
    const isBuild = (s: Span): boolean => build.some((b) => b.start === s.start && b.end === s.end);
    const out: Finding[] = [];
    for (const at of calls) {
      if (!inside(component, at)) continue;
      const enclosing = fns.filter((s) => inside(s, at) && s.start >= component.start && s.end <= component.end);
      if (enclosing.every(isBuild)) out.push(findingAt(file, at));
    }
    return out;
  },
};
