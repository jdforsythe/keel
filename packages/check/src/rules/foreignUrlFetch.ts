import { type Expression, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { isClientReachable } from "../internal/isClientReachable.ts";
import { isDeclaredUrl } from "../internal/isDeclaredUrl.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { urlText } from "../internal/urlText.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const ABSOLUTE = /^\s*(?:https?:)?\/\//i;

/**
 * E1571 (k.security, k.origins): an absolute http(s) or protocol-relative URL, read as `urlText` reads it, given to
 * `ctx.net.fetch` or as `service({ base })` in client-reachable code (`isClientReachable`, E1004's reach), unless its
 * origin is declared under `connect` on each deployable that serves the file (`isDeclaredUrl`). `ctx` is also
 * `<x>.ctx` or a `const` alias of either; `net` also a name destructured as `{ net }`. The policy's `connect-src` is
 * this origin and the declared ones. At the argument; no fix.
 */
export const foreignUrlFetch: RuleDef = {
  code: "E1571",
  message: "absolute URL fetched from client code; the content security policy allows this origin only",
  see: "k.security",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path) || !isClientReachable(file.path, project)) return [];
    const services = localNames(ast, "service", "@keel/services");
    const ctxs = new Set(["ctx"]);
    const nets = new Set<string>();
    const isCtx = (e: Expression): boolean =>
      (e.type === "Identifier" && ctxs.has(e.name)) ||
      (e.type === "MemberExpression" && !e.computed && e.property.name === "ctx");
    new Visitor({
      VariableDeclarator: (d) => {
        if (d.id.type === "Identifier" && d.init !== null && d.init !== undefined && isCtx(d.init)) ctxs.add(d.id.name);
      },
      ObjectPattern: (p) => {
        for (const q of p.properties)
          if (q.type === "Property" && !q.computed && q.key.type === "Identifier" && q.key.name === "net")
            if (q.value.type === "Identifier") nets.add(q.value.name);
      },
    }).visit(ast);
    const out: Finding[] = [];
    const absolute = (e: Parameters<typeof urlText>[0]): boolean => {
      const text = urlText(e, file, project) ?? "";
      return ABSOLUTE.test(text) && !isDeclaredUrl(file.path, project, "connect", text, e?.type === "Literal");
    };
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        const first = n.arguments[0];
        if (c.type === "Identifier" && services.has(c.name) && first?.type === "ObjectExpression") {
          const base = propertyOf(first, "base");
          if (base !== null && absolute(base.value)) out.push(findingAt(file, base.value.start));
          return;
        }
        if (c.type !== "MemberExpression" || c.computed || c.property.name !== "fetch") return;
        const net = c.object;
        const viaNet =
          (net.type === "Identifier" && nets.has(net.name)) ||
          (net.type === "MemberExpression" && !net.computed && net.property.name === "net" && isCtx(net.object));
        if (viaNet && first !== undefined && absolute(first)) out.push(findingAt(file, first.start));
      },
    }).visit(ast);
    return out;
  },
};
