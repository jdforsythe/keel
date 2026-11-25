import { globalRefs } from "@keel/compiler/internal";
import { type Program, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { topologyFor } from "../internal/topologyFor.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** The start offset of the file's `export default` expression, unwrapping parentheses; `-1` when it has none. */
const defaultStart = (ast: Program): number => {
  const st = ast.body.find((s) => s.type === "ExportDefaultDeclaration");
  let d = st?.declaration;
  while (d?.type === "ParenthesizedExpression") d = d.expression;
  return d?.type === "CallExpression" ? d.start : -1;
};

/**
 * E1593 (k.mount Rules): an `identityMount` call from `@keel/router` (any local name) in a code file of the project
 * that is not a test file, but the call that is the `export default` expression of `identity.ts` beside
 * `topology.ts` (the project root when there is none). Only that default export reaches the router and a shell; any
 * other call opens no path and alone puts the `/__keel/user` read in the bundle. Reported at the call. No fix.
 */
export const identityMountElsewhere: RuleDef = {
  code: "E1593",
  message: () => "identityMount is for identity.ts's default export; import that file instead",
  see: "k.mount",
  check: ({ file, ast, project }) => {
    if (isTestPath(file.path)) return [];
    const names = localNames(ast, "identityMount", "@keel/router");
    if (names.size === 0) return [];
    const dir = topologyFor(file.path, project)?.dir ?? "";
    const exempt = file.path === `${dir}identity.ts` ? defaultStart(ast) : -1;
    const g = globalRefs(ast);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "Identifier" || !names.has(c.name) || !g.sameBinding(c.name, ast.start, c.start)) return;
        if (n.start !== exempt) out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
