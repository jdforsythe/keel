import { globalRefs } from "@keel/compiler/internal";
import { Visitor } from "oxc-parser";
import type { Argument } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { keyName } from "../internal/keyName.ts";
import { localNames } from "../internal/modules/localNames.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** Kernel and stdlib packages create detached scopes; only code outside `packages/` is app code. */
const LIBRARY = /(?:^|\/)packages\//;

/** Whether the options argument can create a detached scope: not a literal, or a `detached` other than `false`. */
function mayDetach(opts: Argument): boolean {
  if (opts.type !== "ObjectExpression") return true;
  for (const p of opts.properties) {
    if (p.type === "SpreadElement") return true;
    if (p.computed) return true;
    if (keyName(p) !== "detached") continue;
    if (!(p.value.type === "Literal" && p.value.value === false)) return true;
  }
  return false;
}

/**
 * E1207 (k.reactive): `scope` from `@keel/reactive` (any alias, or `<namespace>.scope`) called in app code with a
 * second argument that may make the scope detached: an object literal whose `detached` is anything but the literal
 * `false`, or one with a spread or computed key, or any non-literal (identifier, call, conditional). `scope(fn)` and
 * `scope(fn, { onError })` are clean. `scope` counts only where it binds the import (a local of the same name
 * shadows it). Kernel and stdlib code under `packages/` is not checked. No fix: nesting the scope is the author's.
 */
export const noDetachedScope: RuleDef = {
  code: "E1207",
  message: () => "scope({ detached }) is for kernel and stdlib code; app scopes nest in their owner",
  see: "k.reactive",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || LIBRARY.test(file.path)) return [];
    const scopes = localNames(ast, "scope", "@keel/reactive");
    const namespaces = new Set<string>();
    for (const st of ast.body) {
      if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/reactive") continue;
      for (const sp of st.specifiers) if (sp.type === "ImportNamespaceSpecifier") namespaces.add(sp.local.name);
    }
    if (scopes.size === 0 && namespaces.size === 0) return [];
    const g = globalRefs(ast);
    const bound = (name: string, at: number): boolean => g.sameBinding(name, ast.start, at);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        const isScope =
          c.type === "Identifier"
            ? scopes.has(c.name) && bound(c.name, c.start)
            : c.type === "MemberExpression" &&
              !c.computed &&
              c.object.type === "Identifier" &&
              namespaces.has(c.object.name) &&
              bound(c.object.name, c.object.start) &&
              c.property.name === "scope";
        const opts = n.arguments[1];
        if (isScope && opts !== undefined && mayDetach(opts)) out.push(findingAt(file, opts.start));
      },
    }).visit(ast);
    return out;
  },
};
