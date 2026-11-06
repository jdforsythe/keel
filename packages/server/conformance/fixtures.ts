// Fixtures for the k.server conformance suite. Seed for every property: 1337.
// ASSUMPTION (spec does not name the server entry): `@keel/server` exports
// `createApp({ topology, routes, ctx, mode?, log? })` returning `{ fetch(req): Promise<Response> }`,
// `mode` is 'dev' | 'production' (default 'dev'). Components are plain functions returning HTML strings.
// A runtime (JSON) request is a request with `accept: application/json`.
import { createCtx } from "@keel/ctx";
import { action, guard, href, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import type { Result } from "@keel/schema";
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

export interface Behavior {
  show?: (args: { params: { kind: string } }) => Promise<Result<unknown, unknown>>;
  shell?: () => Promise<Result<unknown, unknown>>;
  root?: () => Promise<Result<unknown, unknown>>;
  act?: (input: { kind: string; note: string }) => Result<unknown, unknown> | Promise<Result<unknown, unknown>>;
  deny?: boolean;
}
export interface Counts {
  show: number;
  shell: number;
  root: number;
  act: number;
  component: number;
}

const okPage = () => Promise.resolve(ok({ title: "T" }));

export async function build(b: Behavior, mode: Mode = "production") {
  const n: Counts = { show: 0, shell: 0, root: 0, act: 0, component: 0 };
  const rootLoader = loader(Page, () => {
    n.root++;
    return (b.root ?? okPage)();
  });
  const shellLoader = loader(Page, () => {
    n.shell++;
    return (b.shell ?? okPage)();
  });
  const showLoader = loader(Page, (a: { params: { kind: string } }) => {
    n.show++;
    return (b.show ?? okPage)(a);
  });
  const act = action(Edit, (input: { kind: string; note: string }) => {
    n.act++;
    return Promise.resolve((b.act ?? (() => ok(null)))(input));
  });
  const auth = guard("auth", { redirect: "app.login" }, () =>
    Promise.resolve(b.deny ? err(s.error("keel.denied", s.object({})).make({})) : ok(null)),
  );
  const routes = manifest({
    "app.shell": { component: (p: { children: string }) => `<div id="app">${p.children}</div>`, loader: rootLoader },
    "orders.shell": {
      component: (p: { children: string }) => `<div id="orders">${p.children}</div>`,
      layout: "app.shell",
      loader: shellLoader,
    },
    "orders.show": {
      path: "/orders/:kind",
      params: Params,
      search: Search,
      loader: showLoader,
      actions: { POST: act },
      component: (p: { params: { kind: string } }) => `<main data-page="show">page ${p.params.kind}</main>`,
      layout: "orders.shell",
      guard: auth,
      errorElement: (p: { error: { code: string; message: string } }) =>
        `<section data-error-element="1">${p.error.code}</section>`,
    },
    "app.login": { path: "/login", component: () => "<main>login</main>" },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app", "orders"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
    mode,
  });
  return { app, n, routes, href };
}

export const get = (path: string, headers: Record<string, string> = {}) =>
  new Request(`${BASE}${path}`, { headers });

export function post(path: string, fields: Record<string, string>, headers: Record<string, string> = {}) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(`${BASE}${path}`, { method: "POST", body: fd, headers });
}

export const notFound = s.error("keel.notFound", s.object({}));
export const denied = s.error("keel.denied", s.object({}));
export const fields = s.error("keel.fields", s.object({}));
