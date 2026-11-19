import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1009 (k.boundary): a `guard(...)` call (imported from `@keel/router`) in an app file other than `*.guard.*` or
 * `*.server.*`, as E1551 is for loaders and actions. No fix: moving the guard is a file move.
 */
export const guardInGuardFile: RuleDef = {
  code: "E1009",
  message: "guard outside a *.guard.ts or *.server.ts file; move it to <name>.guard.ts",
  see: "k.boundary",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path) || /^packages\/|\.(?:guard|server)\.[cm]?[jt]sx?$/.test(file.path)) return [];
    const names = localNames(ast, "guard", "@keel/router");
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        if (n.callee.type === "Identifier" && names.has(n.callee.name)) out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
