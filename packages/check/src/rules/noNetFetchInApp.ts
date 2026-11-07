import { Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/**
 * E1651 (k.services): a call `ctx.net.fetch(...)` (or `<x>.ctx.net.fetch(...)`) in app code. Reported at the
 * call; no fix (declaring an endpoint and rewriting the call site is not a one-hunk edit).
 */
export const noNetFetchInApp: RuleDef = {
  code: "E1651",
  message: "ctx.net.fetch in app code; declare an endpoint in a service and call it",
  explain: "HTTP goes through a declared endpoint, so requests are typed, decoded, and replayable under sim.",
  see: "k.services",
  check: ({ file, ast }) => {
    if (!isAppPath(file.path)) return [];
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "MemberExpression" || c.computed || c.property.type !== "Identifier") return;
        if (c.property.name !== "fetch") return;
        const net = c.object;
        if (net.type !== "MemberExpression" || net.computed) return;
        if (net.property.type !== "Identifier" || net.property.name !== "net") return;
        const root = net.object;
        const isCtx =
          (root.type === "Identifier" && root.name === "ctx") ||
          (root.type === "MemberExpression" &&
            !root.computed &&
            root.property.type === "Identifier" &&
            root.property.name === "ctx");
        if (isCtx) out.push(findingAt(file, n.start));
      },
    }).visit(ast);
    return out;
  },
};
