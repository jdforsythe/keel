import { type Argument, type Expression, type Program, Visitor } from "oxc-parser";
import { propertyOf } from "../propertyOf.ts";
import type { Entry } from "./Entry.ts";
import type { FileFacts } from "./FileFacts.ts";
import { localNames } from "./localNames.ts";

type IdFact = FileFacts["ids"][number];

/** A string literal argument (`'x'`, or a template without expressions) as an entry. */
function literal(a: Argument | Expression | undefined): Entry | null {
  if (a === undefined) return null;
  if (a.type === "Literal") {
    const v = a.value;
    return typeof v === "string" ? { value: v, start: a.start, end: a.end } : null;
  }
  if (a.type === "TemplateLiteral" && a.expressions.length === 0) {
    const v = a.quasis[0]?.value.cooked;
    return typeof v === "string" ? { value: v, start: a.start, end: a.end } : null;
  }
  return null;
}

/** The name of an import specifier's `imported` (identifier or string literal). */
const nameOf = (i: { type: string; name?: string; value?: unknown }): string | undefined =>
  i.type === "Identifier" ? i.name : typeof i.value === "string" ? i.value : undefined;

/** Static string keys of a literal object argument (identifier or string-literal keys). */
function keysOf(a: Argument | undefined): Entry[] {
  if (a === undefined || a.type !== "ObjectExpression") return [];
  const out: Entry[] = [];
  for (const p of a.properties) {
    if (p.type !== "Property" || p.computed) continue;
    if (p.key.type === "Identifier") out.push({ value: p.key.name, start: p.key.start, end: p.key.end });
    else {
      const e = literal(p.key.type === "Literal" ? p.key : undefined);
      if (e !== null) out.push(e);
    }
  }
  return out;
}

/** `{ id, path }` of each entry of a literal manifest argument whose `path` is a string literal. */
function pathsOf(a: Argument | undefined): { id: string; path: string }[] {
  if (a === undefined || a.type !== "ObjectExpression") return [];
  return keysOf(a).flatMap((k) => {
    const v = propertyOf(a, k.value)?.value;
    const p = v?.type === "ObjectExpression" ? literal(propertyOf(v, "path")?.value) : null;
    return p === null ? [] : [{ id: k.value, path: p.value }];
  });
}

/** The literal `id` of the last object argument (`store(schema, initial, { id })`). */
function storeId(args: readonly Argument[]): Entry | null {
  const last = args[args.length - 1];
  if (last === undefined || last.type !== "ObjectExpression") return null;
  for (const p of last.properties) {
    if (p.type !== "Property" || p.computed || p.key.type !== "Identifier" || p.key.name !== "id") continue;
    return literal(p.value);
  }
  return null;
}

/**
 * Collect a file's module facts in one AST walk (k.module): imports, route ids passed to `href()` or to the
 * manifest member form `<routes>.href('id', params?)` (rfc:0041; both during the transition), `manifest({...})` route
 * keys and literal paths, `service({ module, schema })` calls from `@keel/services`, `store(..., { id })`, `transaction(store, 'name', ...)`, `s.error('code', ...)`, `ctx.<cap>` uses, and, as capability
 * `observe` (rfc:0071), an `observe` import from `@keel/ctx` (any alias) or `<namespace>.observe`. Callees count only
 * when imported from their kernel package (`@keel/router`, `@keel/store`, `@keel/schema`).
 */
export function scanFile(program: Program): FileFacts {
  const href = localNames(program, "href", "@keel/router");
  const manifest = localNames(program, "manifest", "@keel/router");
  const service = localNames(program, "service", "@keel/services");
  const store = localNames(program, "store", "@keel/store");
  const transaction = localNames(program, "transaction", "@keel/store");
  const schema = localNames(program, "s", "@keel/schema");
  const imports: Entry[] = [];
  const hrefs: Entry[] = [];
  const routes: Entry[] = [];
  const paths: { id: string; path: string }[] = [];
  const services: { module: Entry; schema: Expression | null }[] = [];
  const ids: IdFact[] = [];
  const ctx: Entry[] = [];
  const stores: Argument[] = [];
  // `observe` is a capability (rfc:0071): its import from @keel/ctx (any alias), or `<namespace>.observe`.
  const spaces = new Set<string>();
  for (const st of program.body) {
    const from =
      st.type === "ImportDeclaration" || st.type === "ExportAllDeclaration"
        ? st.source
        : st.type === "ExportNamedDeclaration"
          ? st.source
          : null;
    if (from !== null) imports.push({ value: from.value, start: st.start, end: st.end });
    if (st.type !== "ImportDeclaration" || st.source.value !== "@keel/ctx" || st.importKind === "type") continue;
    for (const sp of st.specifiers) {
      if (sp.type === "ImportNamespaceSpecifier") spaces.add(sp.local.name);
      else if (sp.type === "ImportSpecifier" && sp.importKind !== "type" && nameOf(sp.imported) === "observe")
        ctx.push({ value: "observe", start: sp.start, end: sp.end });
    }
  }
  new Visitor({
    ImportExpression: (n) => {
      const e = literal(n.source);
      if (e !== null) imports.push({ value: e.value, start: n.start, end: n.end });
    },
    CallExpression: (n) => {
      const c = n.callee;
      const a = n.arguments;
      if (c.type === "Identifier") {
        if (href.has(c.name)) {
          const e = literal(a[0]);
          if (e !== null) hrefs.push(e);
        } else if (manifest.has(c.name)) {
          routes.push(...keysOf(a[0]));
          paths.push(...pathsOf(a[0]));
        } else if (service.has(c.name)) {
          const opts = a[0]?.type === "ObjectExpression" ? a[0] : undefined;
          const m = opts === undefined ? null : literal(propertyOf(opts, "module")?.value);
          if (opts !== undefined && m !== null)
            services.push({ module: m, schema: propertyOf(opts, "schema")?.value ?? null });
        } else if (store.has(c.name)) {
          const e = storeId(a);
          if (e !== null) ids.push({ ...e, kind: "store id" });
          if (a[0] !== undefined) stores.push(a[0]);
        } else if (transaction.has(c.name)) {
          const e = literal(a[1]);
          if (e !== null) ids.push({ ...e, kind: "transaction name" });
        }
        return;
      }
      if (c.type !== "MemberExpression" || c.computed) return;
      if (c.property.name === "href") {
        const e = literal(a[0]);
        if (e !== null) hrefs.push(e);
        return;
      }
      if (c.property.name !== "error" || c.object.type !== "Identifier" || !schema.has(c.object.name)) return;
      const e = literal(a[0]);
      if (e !== null) ids.push({ ...e, kind: "error code" });
    },
    MemberExpression: (n) => {
      if (n.object.type === "Identifier" && spaces.has(n.object.name)) {
        const key = n.computed ? literal(n.property)?.value : n.property.type === "Identifier" ? n.property.name : "";
        if (key === "observe") ctx.push({ value: "observe", start: n.start, end: n.end });
      }
      if (n.computed || n.object.type !== "Identifier" || n.object.name !== "ctx") return;
      if (n.property.type === "Identifier") ctx.push({ value: n.property.name, start: n.start, end: n.end });
    },
    VariableDeclarator: (n) => {
      if (n.init?.type !== "Identifier" || n.init.name !== "ctx" || n.id.type !== "ObjectPattern") return;
      for (const p of n.id.properties) {
        if (p.type === "Property" && !p.computed && p.key.type === "Identifier")
          ctx.push({ value: p.key.name, start: p.key.start, end: p.key.end });
      }
    },
  }).visit(program);
  return { imports, hrefs, routes, paths, services, ids, ctx, stores };
}
