import { routeLiterals } from "@keel/compiler";
import { Visitor } from "oxc-parser";
import { clip } from "../internal/clip.ts";
import { endpointRefs } from "../internal/compat/endpointRefs.ts";
import { resolveExpr } from "../internal/compat/resolveExpr.ts";
import { samePath } from "../internal/compat/samePath.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

const IN_MODULE = /^((?:.*\/)?)modules\/[^/]+\//;

/**
 * E1567 (k.compat): a `service({ base, schema })` call in app code whose `base` is not an http(s) URL literal and whose
 * `schema` (an `endpoints({...})` literal, through consts and relative imports) has an endpoint that a route of an app
 * module (`modules/<m>/routes.ts`) of this project serves, read by `routeLiterals`: its literal `path` matches
 * (`samePath`) and, for a method other than GET or HEAD, `routes.actions` binds that method. One per call, at `base`,
 * naming the module. No fix: the module, `deps` and `public.routes` edits span files.
 */
export const sameAppBaseService: RuleDef = {
  code: "E1567",
  message: (f) => `service({ base }) calls ${str(f.data, "call")} of app module ${str(f.data, "module")}`,
  see: "k.compat",
  check: ({ file, ast, project }) => {
    const names = localNames(ast, "service", "@keel/services");
    if (!isAppPath(file.path) || names.size === 0) return [];
    const dir = IN_MODULE.exec(file.path)?.[1] ?? "";
    const sub = project.flatMap((f) => (f.path.startsWith(dir) ? [{ ...f, path: f.path.slice(dir.length) }] : []));
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const opts = n.arguments[0];
        if (n.callee.type !== "Identifier" || !names.has(n.callee.name) || opts?.type !== "ObjectExpression") return;
        const base = propertyOf(opts, "base");
        const v = base && resolveExpr(base.value, file, project)?.expr;
        if (!base || (v?.type === "Literal" && /^https?:\/\//i.test(String(v.value)))) return;
        const routes = Object.entries(routeLiterals(sub)?.routes ?? {});
        for (const e of endpointRefs(propertyOf(opts, "schema")?.value, file, project)) {
          const hit = routes.find(
            ([id, r]) =>
              sub.some((f) => f.path === `modules/${id.split(".")[0]}/routes.ts`) &&
              typeof r.path === "string" &&
              samePath(r.path, e.path) &&
              (e.method === "GET" || e.method === "HEAD" || r.actions?.includes(e.method) === true),
          );
          if (hit === undefined) continue;
          const call = `${e.method} ${clip(e.path, 24)}`;
          out.push(findingAt(file, base.start, { module: hit[0].split(".")[0] ?? "", call }));
          return;
        }
      },
    }).visit(ast);
    return out;
  },
};
