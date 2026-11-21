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

const isLive = (e: Expression | null | undefined): boolean =>
  e?.type === "FunctionExpression" && e.async && e.generator;

/**
 * E1558 (k.topology): server-only route work in a module a `client` or `static` deployable serves. In each
 * `modules/<m>/**\/*.server.ts(x)` of such a module, a call `loader(contract, id, decl, fn)` or
 * `action(contract, id, decl, fn)` imported from `@keel/router` (by name, or as a member of an `import * as`
 * namespace) is one E1558 at the call when its `decl` names `stores`, when a loader's `fn` is `async function*` (inline,
 * or a top-level function or `const` of the file), or when the call cannot be read: `decl` not an object literal, or
 * holding a spread or computed key; a spread argument; a loader `fn` neither a function or arrow expression nor the name of a
 * top-level function or `const` function of the file (an imported `fn` included); its message names which. Not read:
 * an alias (`const l = loader`), a destructure from a namespace import (`const { loader } = r`), a `fn` that is not
 * `async function*` but returns a generator, or a call made from another file; `createApp` still throws E1558 for
 * those holding server state.
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
    const spaces = new Set<string>();
    // Top-level functions by name: a declaration or a `const` function or arrow; true when `async function*`.
    const fns = new Map<string, boolean>();
    for (const s of program.body) {
      if (s.type === "ImportDeclaration" && s.source.value === "@keel/router" && s.importKind !== "type")
        for (const x of s.specifiers) {
          if (x.type === "ImportNamespaceSpecifier") spaces.add(x.local.name);
          if (x.type === "ImportSpecifier" && x.importKind !== "type" && x.imported.type === "Identifier")
            if (x.imported.name === "loader" || x.imported.name === "action") kinds.set(x.local.name, x.imported.name);
        }
      const d = s.type === "ExportNamedDeclaration" || s.type === "ExportDefaultDeclaration" ? s.declaration : s;
      if (d?.type === "FunctionDeclaration" && d.id) fns.set(d.id.name, d.async && d.generator);
      if (d?.type === "VariableDeclaration" && d.kind === "const")
        for (const v of d.declarations) {
          const init = v.init && bare(v.init);
          if (
            v.id.type === "Identifier" &&
            (init?.type === "FunctionExpression" || init?.type === "ArrowFunctionExpression")
          )
            fns.set(v.id.name, isLive(init));
        }
    }
    new Visitor({
      CallExpression: (c) => {
        const callee = c.callee;
        const kind =
          callee.type === "Identifier"
            ? kinds.get(callee.name)
            : callee.type === "MemberExpression" &&
                !callee.computed &&
                callee.object.type === "Identifier" &&
                spaces.has(callee.object.name) &&
                (callee.property.name === "loader" || callee.property.name === "action")
              ? callee.property.name
              : undefined;
        if (kind === undefined) return;
        // `loader(contract, id, decl, fn)` and `action(contract, id, decl, fn)` (k.contract Handlers).
        const [, , opts, fn] = c.arguments.map((a) => (a.type === "SpreadElement" ? undefined : bare(a)));
        const props = opts?.type === "ObjectExpression" ? opts.properties : [];
        const stores = props.some(
          (p) =>
            p.type === "Property" &&
            !p.computed &&
            (p.key.type === "Identifier" ? p.key.name : p.key.type === "Literal" && p.key.value) === "stores",
        );
        const live = kind === "loader" && (isLive(fn) || (fn?.type === "Identifier" && fns.get(fn.name) === true));
        const serve = `; serve module ${m} from a node deployable`;
        const why = stores
          ? `names stores${serve}`
          : live
            ? `is live${serve}`
            : opts?.type !== "ObjectExpression"
              ? "decl not an object literal; write one inline"
              : c.arguments.some((a) => a.type === "SpreadElement") ||
                  props.some((p) => p.type === "SpreadElement" || p.computed)
                ? "decl spread or computed; write an object literal"
                : kind === "loader" &&
                    fn?.type !== "FunctionExpression" &&
                    fn?.type !== "ArrowFunctionExpression" &&
                    !(fn?.type === "Identifier" && fns.has(fn.name))
                  ? "fn not a function of this file; define it here"
                  : undefined;
        if (why === undefined) return;
        out.push({
          code: "E1558",
          path: f.path,
          ...lineCol(f.source, c.start),
          message: `${at[0]} deployable ${at[1]}: ${kind} ${why}`,
          see: "k.topology",
        });
      },
    }).visit(program);
  }
  return out;
}
