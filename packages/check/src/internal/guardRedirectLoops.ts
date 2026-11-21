import { type Expression, type Program, Visitor } from "oxc-parser";
import type { Diagnostic } from "../types/Diagnostic.ts";
import type { SourceFile } from "../types/SourceFile.ts";
import type { Checked } from "./Checked.ts";
import type { ContractEntry } from "./ContractEntry.ts";
import { bindingCalls } from "./bindingCalls.ts";
import { clip } from "./clip.ts";
import { contractCalls } from "./contractCalls.ts";
import { isAppPath } from "./isAppPath.ts";
import { lineCol } from "./lineCol.ts";
import { joinPath } from "./modules/joinPath.ts";
import { localNames } from "./modules/localNames.ts";
import { propertyOf } from "./propertyOf.ts";

type GuardDecl = { readonly name: string; readonly redirect: string; readonly at: number; readonly file: SourceFile };
type RouteFacts = { readonly layout: string | null; readonly guard: string | null };
type Kind = ContractEntry["kind"];

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

/**
 * Guards (`const x = guard({ redirect: 'lit' }, fn)`), binding entries (`manifest(contract, { id: { layout, guard } })`)
 * and each contract id's kind (k.contract).
 */
function scan(
  c: Checked,
  guards: Map<string, GuardDecl>,
  routes: Map<string, RouteFacts>,
  kinds: Map<string, Kind>,
): void {
  const { file, parsed } = c;
  for (const call of contractCalls(file, parsed.program)) for (const e of call.list) kinds.set(e.id, e.kind);
  const guardFns = localNames(parsed.program, "guard", "@keel/router");
  const bindings = bindingCalls(file, parsed.program);
  if (guardFns.size === 0 && bindings.length === 0) return;
  const imports = importedFrom(parsed.program, file.path);
  const ref = (name: string): string => imports.get(name) ?? `${stem(file.path)}#${name}`;
  for (const call of bindings)
    for (const { id, obj } of call.list) {
      if (obj === null) continue;
      const g = propertyOf(obj, "guard")?.value;
      routes.set(id, {
        layout: literal(propertyOf(obj, "layout")?.value),
        guard: g?.type === "Identifier" ? ref(g.name) : null,
      });
    }
  if (guardFns.size === 0) return;
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
 * E1508 (k.guards), static half: a guard whose literal `redirect` is an API entry of a contract (k.contract), which
 * has no page to redirect to, or whose `redirect` route has that same guard in its chain, so a denial redirects into
 * itself. Only what the files show: a literal `redirect`, bindings' literal `layout` and `guard: <identifier>` (local
 * or a relative named import). A computed redirect, a guard reached another way,
 * or a loop through two guards is left to the runtime half (the server and router answer E1508). No fix: which
 * route moves out of the guarded layout is a design choice.
 */
export function guardRedirectLoops(files: readonly Checked[]): Diagnostic[] {
  const guards = new Map<string, GuardDecl>();
  const routes = new Map<string, RouteFacts>();
  const kinds = new Map<string, Kind>();
  for (const c of files) if (isAppPath(c.file.path)) scan(c, guards, routes, kinds);
  const out: Diagnostic[] = [];
  for (const [key, g] of guards) {
    const api = kinds.get(g.redirect) === "api";
    if (!api && !guardedBy(g.redirect, key, routes)) continue;
    const { line, col } = lineCol(g.file.source, g.at);
    const why = api ? "an API route; redirect to a page" : `which ${g.name} guards: a redirect loop`;
    const message = clip(`guard ${g.name} redirects to ${g.redirect}, ${why}`, 89);
    out.push({ kind: "diag", code: "E1508", path: g.file.path, line, col, message, see: "k.guards" });
  }
  return out;
}
