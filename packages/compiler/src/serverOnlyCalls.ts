import { type Expression, Visitor, parseSync } from "oxc-parser";
import { lineCol } from "./internal/lineCol.ts";
import type { Diagnostic } from "./types/Diagnostic.ts";
import type { SourceFile } from "./types/SourceFile.ts";
import type { Topology } from "./types/Topology.ts";

const SERVER_FILE = /^modules\/([^/]+)\/(?:.+\/)?[^/]+\.server\.tsx?$/;

const bare = (e: Expression): Expression =>
  e.type === "ParenthesizedExpression" || e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression"
    ? bare(e.expression)
    : e;

/**
 * E1558 (k.topology): server-only route work in a module a `client` or `static` deployable serves. In each
 * `modules/<m>/**\/*.server.ts(x)` of such a module, a call of `loader` or `action` imported by name from `@keel/router`
 * whose first argument is an object literal with a `stores` key, or a `loader` call whose second argument is an
 * `async function*` expression, is one E1558 at the call. A namespace import, a wrapper or a spread `stores` is not read.
 */
export function serverOnlyCalls(files: readonly SourceFile[], topology: Topology): Diagnostic[] {
  const served = new Map<string, readonly [string, string]>();
  for (const [name, d] of Object.entries(topology))
    if (d.adapter !== "node") for (const m of d.modules) served.set(m, [d.adapter, name]);
  const out: Diagnostic[] = [];
  for (const f of files) {
    const m = SERVER_FILE.exec(f.path)?.[1];
    const at = m === undefined ? undefined : served.get(m);
    if (at === undefined) continue;
    const { program } = parseSync(f.path, f.source, {
      sourceType: "module",
      lang: f.path.endsWith("x") ? "tsx" : "ts",
    });
    const kinds = new Map<string, string>();
    for (const s of program.body)
      if (s.type === "ImportDeclaration" && s.source.value === "@keel/router" && s.importKind !== "type")
        for (const x of s.specifiers)
          if (x.type === "ImportSpecifier" && x.importKind !== "type" && x.imported.type === "Identifier")
            if (x.imported.name === "loader" || x.imported.name === "action") kinds.set(x.local.name, x.imported.name);
    new Visitor({
      CallExpression: (c) => {
        const kind = c.callee.type === "Identifier" ? kinds.get(c.callee.name) : undefined;
        const [opts, fn] = c.arguments.map((a) => (a.type === "SpreadElement" ? a : bare(a)));
        const stores =
          opts?.type === "ObjectExpression" &&
          opts.properties.some(
            (p) =>
              p.type === "Property" &&
              !p.computed &&
              ((p.key.type === "Identifier" && p.key.name === "stores") ||
                (p.key.type === "Literal" && p.key.value === "stores")),
          );
        const live = kind === "loader" && fn?.type === "FunctionExpression" && fn.async && fn.generator;
        if (kind === undefined || !(stores || live)) return;
        out.push({
          code: "E1558",
          path: f.path,
          ...lineCol(f.source, c.start),
          message: `${at[0]} deployable ${at[1]}: ${kind} ${live ? "is live" : "names stores"}; serve module ${m} from a node deployable`,
          see: "k.topology",
        });
      },
    }).visit(program);
  }
  return out;
}
