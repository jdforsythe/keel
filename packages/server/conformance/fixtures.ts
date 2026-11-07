// Fixtures for the k.server conformance suite. Seed for every property: 1337.
// ASSUMPTION (spec does not name the server entry): `@keel/server` exports
// `createApp({ topology, routes, ctx, mode?, log? })` returning `{ fetch(req): Promise<Response> }`,
// `mode` is 'dev' | 'production' (default 'dev').
// Components build DOM nodes (RouteDef.component returns Node); test files that call build() run under happy-dom.
// A runtime (JSON) request is a request with `accept: application/json`.
import { createCtx } from "@keel/ctx";
import { action, guard, href, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import type { Href, RouteProps } from "@keel/router";
import type { KeelError, Result } from "@keel/schema";
import * as server from "@keel/server";
import { topology } from "@keel/server";

export const SEED = 1337;
export const BASE = "http://localhost";

export interface App {
  fetch(req: Request): Promise<Response>;
}
export type Mode = "dev" | "production";
export interface AppOptions {
  topology: unknown;
  routes: unknown;
  ctx: unknown;
  mode?: Mode;
  guards?: unknown;
}
export type CreateApp = (o: AppOptions) => App | Promise<App>;

function isCreateApp(v: unknown): v is CreateApp {
  return typeof v === "function";
}
const ns: Record<string, unknown> = server;
export function createApp(o: AppOptions): Promise<App> {
  const f = ns["createApp"];
  if (!isCreateApp(f)) return Promise.reject(new Error("@keel/server does not export createApp"));
  return Promise.resolve(f(o));
}

export const Kind = s.enum(["open", "closed"]);
export const kinds = ["open", "closed"] as const;
export const Params = s.object({ kind: Kind });
export const Search = s.object({ tab: s.enum(["items", "history"]).optional() });
export const Page = s.object({ title: s.string() });
export const Edit = s.object({ kind: Kind, note: s.string() });
export const Boom = s.error("orders.boom", s.object({}));

export interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}
export function deferred(): Deferred {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

// Behaviors may return data that violates the Page schema on purpose (E1554), so they are typed `unknown`.
type PageResult = Promise<Result<unknown, KeelError<string, unknown>>>;
type ActResult = Result<Href | null, KeelError<string, unknown>>;
export interface Behavior {
  show?: (args: { params: { kind: string } }) => PageResult;
  shell?: () => PageResult;
  root?: () => PageResult;
  act?: (input: { kind: string; note: string }) => ActResult | Promise<ActResult>;
  deny?: boolean;
}
export interface Counts {
  show: number;
  shell: number;
  root: number;
  act: number;
  component: number;
}

const okPage = (): PageResult => Promise.resolve(ok({ title: "T" }));

// Deliberately widens a behavior result to the loader's declared type: the server must catch the mismatch.
function erase(v: PageResult) {
  return Reflect.apply(Object, undefined, [v]);
}

function el(tag: string, attrs: Record<string, string>, ...kids: (Node | string)[]): Node {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  e.append(...kids);
  return e;
}

export async function build(b: Behavior, mode: Mode = "production") {
  const n: Counts = { show: 0, shell: 0, root: 0, act: 0, component: 0 };
  const rootLoader = loader({ output: Page }, () => {
    n.root++;
    return erase((b.root ?? okPage)());
  });
  const shellLoader = loader({ output: Page }, () => {
    n.shell++;
    return erase((b.shell ?? okPage)());
  });
  const showLoader = loader({ output: Page, params: Params, search: Search }, (a) => {
    n.show++;
    return erase((b.show ?? okPage)(a));
  });
  const act = action({ input: Edit }, (input: { kind: string; note: string }) => {
    n.act++;
    return Promise.resolve((b.act ?? (() => ok(null)))(input));
  });
  const auth = guard("auth", { redirect: "app.login" }, () =>
    Promise.resolve(b.deny ? err(s.error("keel.denied", s.object({})).make({})) : ok(null)),
  );
  const routes = manifest({
    "app.shell": { component: (p: RouteProps) => el("div", { id: "app" }, p.children?.() ?? ""), loader: rootLoader },
    "orders.shell": {
      component: (p: RouteProps) => el("div", { id: "orders" }, p.children?.() ?? ""),
      layout: "app.shell",
      loader: shellLoader,
    },
    "orders.show": {
      path: "/orders/:kind",
      params: Params,
      search: Search,
      loader: showLoader,
      actions: { POST: act },
      component: (p: RouteProps) =>
        el("main", { "data-page": "show" }, `page ${String(Reflect.get(Object(p.params), "kind"))}`),
      layout: "orders.shell",
      guard: "auth",
      errorElement: (p: { readonly error: KeelError<string, unknown> }) =>
        el("section", { "data-error-element": "1" }, p.error.code),
    },
    "app.login": { path: "/login", component: () => el("main", {}, "login") },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app", "orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
    guards: [auth],
  });
  return { app, n, routes, href };
}

export const get = (path: string, headers: Record<string, string> = {}) => new Request(`${BASE}${path}`, { headers });

export function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(`${BASE}${path}`, { method: "POST", body: fd, headers });
}

export const notFound = s.error("keel.notFound", s.object({}));
export const denied = s.error("keel.denied", s.object({}));
export const fields = s.error("keel.fields", s.object({}));
