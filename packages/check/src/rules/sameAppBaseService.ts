import type { Expression } from "oxc-parser";
import { Visitor } from "oxc-parser";
import type { Checked } from "../internal/Checked.ts";
import { clip } from "../internal/clip.ts";
import { endpointRefs } from "../internal/compat/endpointRefs.ts";
import { resolveExpr } from "../internal/compat/resolveExpr.ts";
import { samePath } from "../internal/compat/samePath.ts";
import { findingAt } from "../internal/findingAt.ts";
import { isAppPath } from "../internal/isAppPath.ts";
import { moduleContracts } from "../internal/moduleContracts.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { namespaceNames } from "../internal/modules/namespaceNames.ts";
import { parseFile } from "../internal/parseFile.ts";
import { propertyOf } from "../internal/propertyOf.ts";
import { str } from "../internal/str.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";
import type { SourceFile } from "../types/SourceFile.ts";

const IN_MODULE = /^((?:.*\/)?)modules\/[^/]+\//;
const CONTRACT = /(?:^|\/)modules\/([^/]+)\/\1\.contract\.ts$/;

type Served = { readonly module: string; readonly method: string; readonly path: string };

const literal = (e: Expression | undefined): string | null =>
  e?.type === "Literal" && typeof e.value === "string" ? e.value : null;

/** The literal method (upper case) and path of every API entry of the app module contracts under `dir`. */
function served(dir: string, project: readonly SourceFile[]): Served[] {
  const files: Checked[] = project.flatMap((file) =>
    CONTRACT.test(file.path) ? [{ file, parsed: parseFile(file) }] : [],
  );
  return moduleContracts(files).flatMap(({ dir: at, module, contract }) =>
    at !== dir
      ? []
      : contract.list.flatMap((e) => {
          const method = e.kind === "api" && e.obj !== null ? literal(propertyOf(e.obj, "method")?.value) : null;
          const path = e.obj === null ? null : literal(propertyOf(e.obj, "path")?.value);
          return method === null || path === null ? [] : [{ module, method: method.toUpperCase(), path }];
        }),
  );
}

/**
 * E1567 (k.compat): a `service({ base, schema })` call in app code (a named, aliased or namespace import of
 * `@keel/services`) whose `base` is not an http(s) URL literal and whose `schema` (an `endpoints({...})` literal,
 * through consts and relative imports) has an endpoint that an API entry of an app module's contract
 * (`modules/<m>/<m>.contract.ts`) of this project serves: the same literal method (HEAD meets GET) and a `samePath`
 * path. One per call, at `base`, naming the module. No fix: the caller moves to `service({ contract })`.
 */
export const sameAppBaseService: RuleDef = {
  code: "E1567",
  message: (f) => `service({ base }) calls ${str(f.data, "call")} of app module ${str(f.data, "module")}`,
  see: "k.compat",
  check: ({ file, ast, project }) => {
    const names = localNames(ast, "service", "@keel/services");
    const spaces = namespaceNames(ast, "@keel/services");
    if (!isAppPath(file.path) || (names.size === 0 && spaces.size === 0)) return [];
    const dir = IN_MODULE.exec(file.path)?.[1] ?? "";
    let api: Served[] | null = null;
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const opts = n.arguments[0];
        const c = n.callee;
        const isService =
          c.type === "Identifier"
            ? names.has(c.name)
            : c.type === "MemberExpression" &&
              !c.computed &&
              c.object.type === "Identifier" &&
              spaces.has(c.object.name) &&
              c.property.name === "service";
        if (!isService || opts?.type !== "ObjectExpression") return;
        const base = propertyOf(opts, "base");
        const v = base && resolveExpr(base.value, file, project)?.expr;
        if (!base || (v?.type === "Literal" && /^https?:\/\//i.test(String(v.value)))) return;
        api ??= served(dir, project);
        const entries = api;
        for (const e of endpointRefs(propertyOf(opts, "schema")?.value, file, project)) {
          const method = e.method === "HEAD" ? "GET" : e.method;
          const hit = entries.find((r) => r.method === method && samePath(r.path, e.path));
          if (hit === undefined) continue;
          out.push(findingAt(file, base.start, { module: hit.module, call: `${e.method} ${clip(e.path, 24)}` }));
          return;
        }
      },
    }).visit(ast);
    return out;
  },
};
