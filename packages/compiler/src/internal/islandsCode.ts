import path from "node:path";
import { type Expression, type ObjectExpression, type Statement, parseSync } from "oxc-parser";

type Bound = { readonly source: string; readonly imported: string };

const IDENT = /^[A-Za-z_$][\w$]*$/;

function unwrap(e: Expression): Expression {
  if (e.type === "ParenthesizedExpression") return unwrap(e.expression);
  if (e.type === "TSAsExpression" || e.type === "TSSatisfiesExpression") return unwrap(e.expression);
  return e;
}

function keyName(k: Expression | { type: string }): string | undefined {
  if ("name" in k && typeof k.name === "string" && k.type === "Identifier") return k.name;
  if (k.type === "Literal" && "value" in k && typeof k.value === "string") return k.value;
  return undefined;
}

/** The binding object literal of `manifest(contract, {...})` when `e` is that call. */
function manifestArg(e: Expression | null): ObjectExpression | undefined {
  const c = e === null ? undefined : unwrap(e);
  if (c?.type !== "CallExpression" || c.callee.type !== "Identifier" || c.callee.name !== "manifest") return undefined;
  const arg = c.arguments[1];
  if (arg === undefined || arg.type === "SpreadElement") return undefined;
  const o = unwrap(arg);
  return o.type === "ObjectExpression" ? o : undefined;
}

/** Every `manifest(contract, {...})` binding literal bound at the top level (`const`, `export const`, `export default`). */
function manifests(body: readonly Statement[]): ObjectExpression[] {
  const out: ObjectExpression[] = [];
  for (const s of body) {
    const d = s.type === "ExportNamedDeclaration" ? s.declaration : s;
    if (s.type === "ExportDefaultDeclaration") {
      const e = s.declaration;
      if (e.type !== "FunctionDeclaration" && e.type !== "ClassDeclaration" && e.type !== "TSInterfaceDeclaration") {
        const m = manifestArg(e);
        if (m !== undefined) out.push(m);
      }
    }
    if (d?.type !== "VariableDeclaration") continue;
    for (const v of d.declarations) {
      const m = manifestArg(v.init);
      if (m !== undefined) out.push(m);
    }
  }
  return out;
}

/**
 * The generated `/@keel/islands.ts` (k.runtime, RFC 0046): `export const components`, route id -> the route's
 * component, for the resume entry. Static and best effort, like island marking: in each `routes.ts` (root-relative
 * `path`, or absolute for a stdlib package's), a `manifest(contract, {...})` binding entry with a literal route id whose `component`
 * is an imported identifier contributes that import (relative specifiers become root-relative, `/`-prefixed). Anything else (inline components, a file that
 * does not parse) is skipped; `resume` leaves such an island static. Sorted by route id; deterministic.
 */
export function islandsCode(files: readonly { readonly path: string; readonly source: string }[]): string {
  const found = new Map<string, Bound>();
  for (const f of files) {
    const { program, errors } = parseSync(f.path, f.source, { sourceType: "module", lang: "ts" });
    if (errors.length > 0) continue;
    const bound = new Map<string, Bound>();
    for (const s of program.body) {
      if (s.type !== "ImportDeclaration" || s.importKind === "type") continue;
      const spec = s.source.value;
      const at = path.posix.join(path.posix.dirname(f.path), spec);
      const source = !spec.startsWith(".") ? spec : at.startsWith("/") ? at : `/${at}`;
      for (const sp of s.specifiers) {
        if (sp.type === "ImportDefaultSpecifier") bound.set(sp.local.name, { source, imported: "default" });
        if (sp.type !== "ImportSpecifier" || sp.importKind === "type") continue;
        const imported = keyName(sp.imported);
        if (imported !== undefined) bound.set(sp.local.name, { source, imported });
      }
    }
    for (const routes of manifests(program.body))
      for (const p of routes.properties) {
        const id = p.type === "Property" && !p.computed ? keyName(p.key) : undefined;
        const def = p.type === "Property" ? unwrap(p.value) : undefined;
        if (id === undefined || def?.type !== "ObjectExpression") continue;
        for (const q of def.properties) {
          if (q.type !== "Property" || q.computed || keyName(q.key) !== "component") continue;
          const c = unwrap(q.value);
          const b = c.type === "Identifier" ? bound.get(c.name) : undefined;
          if (b !== undefined) found.set(id, b);
        }
      }
  }
  const ids = [...found.keys()].sort();
  const lines: string[] = [];
  const entries: string[] = [];
  ids.forEach((id, i) => {
    const b = found.get(id);
    if (b === undefined) return;
    const local = `__keelIsland${i}`;
    const name = IDENT.test(b.imported) ? b.imported : JSON.stringify(b.imported);
    const clause = b.imported === "default" ? local : `{ ${name} as ${local} }`;
    lines.push(`import ${clause} from ${JSON.stringify(b.source)};`);
    entries.push(`${JSON.stringify(id)}: ${local}`);
  });
  return [...lines, `export const components = { ${entries.join(", ")} };`, ""].join("\n");
}
