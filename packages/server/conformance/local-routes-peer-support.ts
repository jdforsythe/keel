// Shared fixture for the k.topology local-route peer conformance files (not a test file). Seed for every property: 1337.
// `x` serves module `a` and forwards to `y`, which serves module `b` and holds `b.tools` (`/tools`, a `local: true` page with a guard and a loader),
// `b.slug` (`/:slug`, a page that is not local), `b.open` (`/open`) and `b.feed` (`/api/feed`, a `local: true` live API entry, `events: true`).
// Each handler of `y` counts its own runs in `hits`, so "its loader not run" is read from outside. `x` reaches `y` through the sim net at `http://y.test`; the request
// `y` gets carries `Host: 127.0.0.1:<port>` (a peer on loopback) and `y` sees a connection from `127.0.0.1`, so only the request's own headers can refuse it.
// ASSUMED: (1) `routesArtifact` writes `local: true` for a `local` entry (k.contract: ".keel/routes.json ... marks that entry `local: true`");
// (2) the connection is the shape `createApp`'s `fetch(request, connection)` reads: `{ incoming: { socket: { remoteAddress } } }`; (3) the 403 body holds the text `keel.denied`.
import { createCtx } from "@keel/ctx";
import { guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { expect } from "vitest";
import { SEED, createAppLoose, liveLoader, withHeaders, writeArtifacts } from "./topology-fixtures.ts";
import type { Fetcher } from "./topology-fixtures.ts";

export { SEED };
export type Conn = { incoming: { socket: { remoteAddress: string } } };
export type App = { fetch(req: Request, connection?: Conn): Promise<Response> };
export const conn = (remoteAddress: string): Conn => ({ incoming: { socket: { remoteAddress } } });

export const SIX: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};
export const six = (res: Response, label: string): void => {
  for (const [name, value] of Object.entries(SIX)) expect(res.headers.get(name), `${label}: ${name}`).toBe(value);
};

export const PORT = 4317;
export type Seen = { method: string; path: string; forwarded: string | null };
export type Hits = { tools: number; guard: number; slug: number; open: number; feed: number };

const Page = s.object({ title: s.string() });
const Tick = s.object({ n: s.int() });
const page = (): Node => document.createElement("main");

export const get = (path: string, extra: Record<string, string> = {}, method = "GET"): Request =>
  withHeaders(
    new Request(`http://127.0.0.1:${PORT}${path}`, { method, headers: { accept: "application/json" } }),
    extra,
  );
/** The headers of a request that satisfies Host and Sec-Fetch-Site of a local route. */
export const GOOD: Record<string, string> = { host: `127.0.0.1:${PORT}`, "sec-fetch-site": "none" };

/** `x` forwarding to `y`; `seen` holds each request `y` receives through `x`, `hits` each handler run of `y`. */
export async function pair(): Promise<{ x: App; y: App; seen: Seen[]; hits: Hits }> {
  const hits: Hits = { tools: 0, guard: 0, slug: 0, open: 0, feed: 0 };
  const c = contract("b", {
    "b.tools": { path: "/tools", local: true },
    "b.slug": { path: "/:slug", params: s.object({ slug: s.string() }) },
    "b.open": { path: "/open" },
    "b.feed": { method: "GET", path: "/api/feed", events: true, output: Tick, local: true },
  });
  const tools = loader(c, "b.tools", { output: Page }, () => {
    hits.tools += 1;
    return Promise.resolve(ok({ title: "tools" }));
  });
  const slug = loader(c, "b.slug", { output: Page }, () => {
    hits.slug += 1;
    return Promise.resolve(ok({ title: "slug" }));
  });
  const open = loader(c, "b.open", { output: Page }, () => {
    hits.open += 1;
    return Promise.resolve(ok({ title: "open" }));
  });
  const feed = liveLoader(c, "b.feed", async function* () {
    hits.feed += 1;
    yield ok({ n: 1 });
  });
  const gate = guard({ redirect: "b.open" }, () => {
    hits.guard += 1;
    return Promise.resolve(ok(null));
  });
  const bRoutes = manifest(c, {
    "b.tools": { component: page, loader: tools, guard: gate },
    "b.slug": { component: page, loader: slug },
    "b.open": { component: page, loader: open },
    "b.feed": { loader: feed },
  });
  const ac = contract("a", { "a.home": { path: "/a" } });
  const aRoutes = manifest(ac, { "a.home": { component: page } });
  const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
  const y = asApp(
    await createAppLoose({
      topology: t,
      deployable: "y",
      routes: bRoutes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
    }),
  );
  const seen: Seen[] = [];
  const xCtx = createCtx({ mode: "sim", seed: SEED });
  xCtx.net.route("http://y.test/*", (req) => {
    seen.push({ method: req.method, path: new URL(req.url).pathname, forwarded: req.headers.get("x-keel-forwarded") });
    return y.fetch(withHeaders(req, { host: `127.0.0.1:${PORT}` }), conn("127.0.0.1"));
  });
  const x = asApp(
    await createAppLoose({
      topology: t,
      deployable: "x",
      routes: aRoutes,
      ctx: xCtx,
      peers: { y: "http://y.test" },
      artifacts: writeArtifacts(bRoutes),
    }),
  );
  return { x, y, seen, hits };
}

const asApp = (f: Fetcher): App => ({ fetch: (req, connection) => Reflect.apply(f.fetch, f, [req, connection]) });

export const NONE: Hits = { tools: 0, guard: 0, slug: 0, open: 0, feed: 0 };
