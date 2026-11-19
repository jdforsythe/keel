import { type Expression, type Program, Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import { clip } from "./clip.ts";
import { isAppPath } from "./isAppPath.ts";
import { keyName } from "./keyName.ts";
import { lineCol } from "./lineCol.ts";
import { joinPath } from "./modules/joinPath.ts";
import { localNames } from "./modules/localNames.ts";
import { propertyOf } from "./propertyOf.ts";

type GuardDecl = { readonly name: string; readonly redirect: string; readonly at: number; readonly file: SourceFile };
type RouteFacts = { readonly layout: string | null; readonly guard: string | null; readonly api: boolean };

/** A file path without its JS/TS extension, so `./auth.guard.ts`, `./auth.guard.js`, `./auth.guard` meet. */
const stem = (path: string): string => path.replace(/\.[cm]?[jt]sx?$/, "");
const dirOf = (path: string): string => path.slice(0, Math.max(0, path.lastIndexOf("/")));

const literal = (e: Expression | null | undefined): string | null =>
  e?.type === "Literal" && typeof e.value === "string" ? e.value : null;

/** `local -> stem#exported` for every relative named import of `program` (where a guard value may come from). */
function importedFrom(program: Program, path: string): ReadonlyMap<string, string> {
  const out = new Map<string, string>();
  for (const st of program.body) {
    if (st.type !== "ImportDeclaration" || !st.source.value.startsWith(".")) continue;
    for (const sp of st.specifiers) {
      if (sp.type !== "ImportSpecifier") continue;
      const exported = sp.imported.type === "Identifier" ? sp.imported.name : sp.imported.value;
      out.set(sp.local.name, `${stem(joinPath(dirOf(path), st.source.value))}#${exported}`);
    }
  }
  return out;
}

/** Guards (`const x = guard({ redirect: 'lit' }, fn)`) and manifest routes (`manifest({ id: { layout, guard } })`). */
function scan(c: Checked, guards: Map<string, GuardDecl>, routes: Map<string, RouteFacts>): void {
  const { file, parsed } = c;
  const guardFns = localNames(parsed.program, "guard", "@keel/router");
  const manifestFns = localNames(parsed.program, "manifest", "@keel/router");
  if (guardFns.size === 0 && manifestFns.size === 0) return;
  const imports = importedFrom(parsed.program, file.path);
  const ref = (name: string): string => imports.get(name) ?? `${stem(file.path)}#${name}`;
  new Visitor({
    VariableDeclarator: (n) => {
      const init = n.init;
      if (n.id.type !== "Identifier" || init?.type !== "CallExpression") return;
      if (init.callee.type !== "Identifier" || !guardFns.has(init.callee.name)) return;
      const decl = init.arguments[0];
      if (decl?.type !== "ObjectExpression") return;
      const p = propertyOf(decl, "redirect");
      const redirect = literal(p?.value);
      if (p === null || redirect === null) return;
      guards.set(ref(n.id.name), { name: n.id.name, redirect, at: p.value.start, file });
    },
    CallExpression: (n) => {
      const arg = n.arguments[0];
      if (n.callee.type !== "Identifier" || !manifestFns.has(n.callee.name) || arg?.type !== "ObjectExpression") return;
      for (const p of arg.properties) {
        const id = p.type === "Property" ? keyName(p) : null;
        if (p.type !== "Property" || id === null || p.value.type !== "ObjectExpression") continue;
        const g = propertyOf(p.value, "guard")?.value;
        const api = propertyOf(p.value, "api")?.value;
        routes.set(id, {
          layout: literal(propertyOf(p.value, "layout")?.value),
          guard: g?.type === "Identifier" ? ref(g.name) : null,
          api: api?.type === "Literal" && api.value === true,
        });
      }
    },
  }).visit(parsed.program);
}

/** Whether guard `key` is in the chain of route `id` (the route, then its layouts; a layout cycle stops the walk). */
function guardedBy(id: string, key: string, routes: ReadonlyMap<string, RouteFacts>): boolean {
  const seen = new Set<string>();
  for (let at: string | null = id; at !== null && !seen.has(at); ) {
    seen.add(at);
    const r = routes.get(at);
    if (r === undefined) return false;
    if (r.guard === key) return true;
    at = r.layout;
  }
  return false;
}

/**
 * E1508 (k.guards), static half: a guard whose literal `redirect` is an API route (k.api; a literal
 * `api: true` entry), which has no page to redirect to, or whose `redirect` route has that same guard in its chain,
 * so a denial redirects into itself. Only what the files show: a literal `redirect`, manifests' literal `layout`
 * and `guard: <identifier>` (local or a relative named import). A computed redirect, a guard reached another way,
 * or a loop through two guards is left to the runtime half (the server and router answer E1508). No fix: which
 * route moves out of the guarded layout is a design choice.
 */
export function guardRedirectLoops(files: readonly Checked[]): Diagnostic[] {
  const guards = new Map<string, GuardDecl>();
  const routes = new Map<string, RouteFacts>();
  for (const c of files) if (isAppPath(c.file.path)) scan(c, guards, routes);
  const out: Diagnostic[] = [];
  for (const [key, g] of guards) {
    const api = routes.get(g.redirect)?.api === true;
    if (!api && !guardedBy(g.redirect, key, routes)) continue;
    const { line, col } = lineCol(g.file.source, g.at);
    const why = api ? "an API route; redirect to a page" : `which ${g.name} guards: a redirect loop`;
    const message = clip(`guard ${g.name} redirects to ${g.redirect}, ${why}`, 89);
    out.push({ kind: "diag", code: "E1508", path: g.file.path, line, col, message, see: "k.guards" });
  }
  return out;
}
