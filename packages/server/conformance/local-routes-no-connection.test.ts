// @vitest-environment happy-dom
// Spec: k.contract, clause "The same `GET` with `Sec-Fetch-Site: cross-site`, with no `Sec-Fetch-Site`, or with `Host: example.com`, answers 403 `keel.denied` and its loader does not run."
// k.contract Local routes: "A request `createApp`'s `fetch` gets with no connection (a harness, k.testing) has no remote address and is refused too."
// Seed: n/a (no generated input). Method (happy-dom, whose `Request` drops headers the test sets, so `withHeaders` of topology-fixtures.ts sets them): `createApp` over a manifest holding a `local: true` page and API GET and a non-local API GET, `app.fetch(new Request(...))` with every header the three conditions name satisfied but the one the Request cannot carry: the connection.
// UNTESTABLE here: a peer address handed to `app.fetch`. `spec/` states no seam for a remote address on an in-process request (k.hosting, k.server and k.testing hold none), so no in-process case asserts the answered half; the answered half is local-routes-answered.test.ts over a real connection.
import { createCtx } from "@keel/ctx";
import { guard, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import * as server from "@keel/server";
import { describe, expect, it } from "vitest";
import { withHeaders } from "./topology-fixtures.ts";

const SEED = 1337; // seed 1337 (no random input)
const Out = s.object({ marker: s.string() });
const ran = { page: 0, probe: 0, guard: 0, open: 0 };
const fixture = () => {
  const c = contract("a", {
    "a.panel": { path: "/panel", local: true },
    "a.probe": { method: "GET", path: "/api/probe", output: Out, local: true },
    "a.open": { method: "GET", path: "/api/open", output: Out },
  });
  const panel = loader(c, "a.panel", { output: Out }, async () => {
    ran.page += 1;
    return ok({ marker: "PANEL_MARKER_7f3a91" });
  });
  const probe = loader(c, "a.probe", {}, async () => {
    ran.probe += 1;
    return ok({ marker: "PROBE_MARKER_c20d48" });
  });
  const open = loader(c, "a.open", {}, async () => {
    ran.open += 1;
    return ok({ marker: "OPEN_MARKER_58be10" });
  });
  const gate = guard({}, async () => {
    ran.guard += 1;
    return ok(null);
  });
  const page = (): Node => document.createElement("main");
  const routes = manifest(c, {
    "a.panel": { component: page, loader: panel },
    "a.probe": { loader: probe, guard: gate },
    "a.open": { loader: open },
  });
  return routes;
};

type Fetcher = { fetch(req: Request): Promise<Response> };
const isFetcher = (v: unknown): v is Fetcher => typeof v === "object" && v !== null && "fetch" in v;
const boot = async (): Promise<Fetcher> => {
  const make: unknown = Reflect.get(server, "createApp");
  if (typeof make !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(make, undefined, [
    {
      topology: topology({ web: { modules: ["a"], adapter: "node" } }),
      routes: fixture(),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    },
  ]);
  if (!isFetcher(app)) throw new Error("createApp did not return an app with fetch");
  return app;
};
const req = (path: string, headers: Record<string, string> = {}): Request =>
  withHeaders(new Request(`http://127.0.0.1:3000${path}`), {
    accept: "application/json",
    host: "127.0.0.1:3000",
    "sec-fetch-site": "none",
    ...headers,
  });

describe("k.contract Local routes: a request with no connection", () => {
  it("A request `createApp`'s `fetch` gets with no connection has no remote address and is refused: 403 `keel.denied` on a `local: true` page and API GET, no loader or guard running", async () => {
    const app = await boot();
    for (const path of ["/panel", "/api/probe"]) {
      const r = await app.fetch(req(path));
      const body = await r.text();
      expect(r.status, path).toBe(403);
      expect(body, path).toContain("keel.denied");
      expect(body.includes("PANEL_MARKER_7f3a91") || body.includes("PROBE_MARKER_c20d48"), path).toBe(false);
    }
    const html = await app.fetch(req("/panel", { accept: "text/html", "sec-fetch-site": "same-origin" }));
    expect(html.status).toBe(403);
    expect([ran.page, ran.probe, ran.guard]).toEqual([0, 0, 0]);
  });

  it("a route that is not `local` answers the same in-process request", async () => {
    const app = await boot();
    const r = await app.fetch(req("/api/open"));
    expect(r.status).toBe(200);
    expect(await r.text()).toContain("OPEN_MARKER_58be10");
    expect(ran.open).toBe(1);
  });
});
