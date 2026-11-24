import path from "node:path";
import { globalRefs, references } from "@keel/compiler/internal";
import { type ObjectExpression, type Program, Visitor } from "oxc-parser";
import { findingAt } from "../internal/findingAt.ts";
import { isTestPath } from "../internal/isTestPath.ts";
import { keyName } from "../internal/keyName.ts";
import { localNames } from "../internal/modules/localNames.ts";
import { num } from "../internal/num.ts";
import { str } from "../internal/str.ts";
import { topologyFor } from "../internal/topologyFor.ts";
import type { Edit } from "../types/Edit.ts";
import type { Finding } from "../types/Finding.ts";
import type { RuleDef } from "../types/RuleDef.ts";

/** `identity.ts` of the project as a specifier from the file at `file`: `'../../../identity.ts'`, `'./identity.ts'`. */
const specifierOf = (file: string, identity: string): string => {
  const rel = path.posix.relative(path.posix.dirname(file), identity);
  return rel.startsWith(".") ? rel : `./${rel}`;
};

/** The local name of the file's default import of `identity` (a project path), else `null`. */
const identityImport = (ast: Program, file: string, identity: string): string | null => {
  for (const st of ast.body) {
    if (st.type !== "ImportDeclaration" || st.importKind === "type") continue;
    if (path.posix.join(path.posix.dirname(file), st.source.value) !== identity) continue;
    for (const sp of st.specifiers) if (sp.type === "ImportDefaultSpecifier") return sp.local.name;
  }
  return null;
};

/** The edits that pass `mount` in `opts`: `mount` (or `mount: <name>`) after its last key, `{ mount }` when empty. */
const passMount = (opts: ObjectExpression, value: string): Edit => {
  const key = value === "mount" ? "mount" : `mount: ${value}`;
  const last = opts.properties[opts.properties.length - 1];
  return last === undefined
    ? { start: opts.start, end: opts.end, text: `{ ${key} }` }
    : { start: last.end, end: last.end, text: `, ${key}` };
};

/**
 * E1730 (k.guards Test files): in a test file of a project with `identity.ts` beside `topology.ts`, a `renderRoute`
 * from `@keel/testing` (any alias) whose options are an object literal with no spread, no computed key, and neither
 * `mount` nor `app`. The built app always has the identity mount, so the test names it. Reported at the object's `{`.
 * The fix passes `mount` and, when the file has no default import of `identity.ts`, imports it as `mount` after the
 * last import (`mount: <name>` when it has one under another name); none when the file binds `mount` otherwise.
 * Non-literal options are none. `keel check` only: nothing at run reads the project.
 */
export const identityMountMissing: RuleDef = {
  code: "E1730",
  message: (f) => `renderRoute names no identity mount; import mount from '${str(f.data, "path")}' and pass it`,
  see: "k.guards",
  check: ({ file, ast, project }) => {
    if (!isTestPath(file.path)) return [];
    const names = localNames(ast, "renderRoute", "@keel/testing");
    if (names.size === 0) return [];
    const dir = topologyFor(file.path, project)?.dir;
    if (dir === undefined) return [];
    const identity = `${dir}identity.ts`;
    if (!project.some((f) => f.path === identity)) return [];
    const spec = specifierOf(file.path, identity);
    const g = globalRefs(ast);
    const out: Finding[] = [];
    new Visitor({
      CallExpression: (n) => {
        const c = n.callee;
        if (c.type !== "Identifier" || !names.has(c.name) || !g.sameBinding(c.name, ast.start, c.start)) return;
        const opts = n.arguments[1];
        if (opts?.type !== "ObjectExpression") return;
        const keys = opts.properties.map((p) => (p.type === "SpreadElement" || p.computed ? null : keyName(p)));
        if (keys.some((k) => k === null || k === "mount" || k === "app")) return;
        out.push(findingAt(file, opts.start, { path: spec, start: opts.start }));
      },
    }).visit(ast);
    return out;
  },
  fix: (finding, { file, ast }) => {
    const spec = str(finding.data, "path");
    const at = num(finding.data, "start");
    const identity = path.posix.join(path.posix.dirname(file.path), spec);
    let opts: ObjectExpression | null = null;
    new Visitor({
      ObjectExpression: (n) => {
        if (n.start === at) opts = n;
      },
    }).visit(ast);
    const found: ObjectExpression | null = opts;
    if (found === null) return null;
    const own = identityImport(ast, file.path, identity);
    if (own !== null) return [passMount(found, own)];
    if (references(ast).declared.has("mount")) return null;
    const lastImport = ast.body.filter((s) => s.type === "ImportDeclaration").at(-1);
    if (lastImport === undefined) return null;
    return [
      { start: lastImport.end, end: lastImport.end, text: `\nimport mount from '${spec}';` },
      passMount(found, "mount"),
    ];
  },
};
