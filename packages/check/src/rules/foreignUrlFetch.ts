import { type Argument, Visitor } from "oxc-parser";
import { resolveExpr } from "../internal/compat/resolveExpr.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

const ABSOLUTE = /^https?:\/\//i;

/** True when `arg` is, through consts and relative imports, a literal absolute http(s) URL, or `new Request|URL` of one. */
function absolute(arg: Argument | undefined, file: SourceFile, project: readonly SourceFile[], wrap = true): boolean {
  const at = resolveExpr(arg, file, project);
  const e = at?.expr;
  if (at === null || e === undefined) return false;
  if (e.type === "Literal") return typeof e.value === "string" && ABSOLUTE.test(e.value);
  if (e.type === "TemplateLiteral") return ABSOLUTE.test(e.quasis[0]?.value.cooked ?? "");
  const ctor = e.type === "NewExpression" && e.callee.type === "Identifier" ? e.callee.name : "";
  return wrap && e.type === "NewExpression" && (ctor === "Request" || ctor === "URL")
    ? absolute(e.arguments[0], at.file, project, false)
    : false;
}

/**
 * E1571 (k.security): a literal absolute http(s) URL given to `ctx.net.fetch` (as text, `new Request` or `new URL`)
 * or as `service({ base })` in client-reachable code: an app file other than `*.server.ts` (E1004's reachability).
 * The policy's `connect-src` is this origin. At the argument; no fix.
 */
export const foreignUrlFetch: RuleDef = {
  code: "E1571",
  message: "absolute URL fetched from client code; the content security policy allows this origin only",
  explain: "The browser connects only to this origin; reach another through a server route or service.",
  see: "k.security",
  check: ({ file, ast, project }) => {
    if (!isAppPath(file.path) || /\.server\.[cm]?[jt]sx?$/.test(file.path)) return [];
    const services = localNames(ast, "service", "@keel/services");
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        const first = n.arguments[0];
        if (c.type === "Identifier" && services.has(c.name) && first?.type === "ObjectExpression") {
          const base = propertyOf(first, "base");
          if (base !== null && absolute(base.value, file, project)) out.push(findingAt(file, base.value.start));
          return;
        }
        if (c.type !== "MemberExpression" || c.computed || c.property.name !== "fetch") return;
        const net = c.object;
        if (net.type !== "MemberExpression" || net.computed || net.property.name !== "net") return;
        const ctx = net.object;
        const isCtx =
          (ctx.type === "Identifier" && ctx.name === "ctx") ||
          (ctx.type === "MemberExpression" && !ctx.computed && ctx.property.name === "ctx");
        if (isCtx && first !== undefined && absolute(first, file, project)) out.push(findingAt(file, first.start));
      },
    }).visit(ast);
    return out;
  },
};
