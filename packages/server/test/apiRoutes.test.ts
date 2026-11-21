// @vitest-environment happy-dom
// Examples (k.api): an API entry answers JSON whatever `accept` says; HEAD, 405 `allow` by path pattern, guard 403
// with and without `redirect`, a form POST's `Result` JSON, 422 as JSON, E1511 for `client` and `static` deployables.
import { createCtx } from "@keel/ctx";
import { type RouteTable, action, guard, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const SEED = 1337;
const BASE = "http://localhost";
const Denied = s.error("keel.denied", s.object({}));
const N = s.object({ n: s.int() });
const Note = s.object({ note: s.string({ min: 2 }) });
const Nothing = s.object({});
const page = (): Node => document.createElement("main");
const denyTo = guard({ redirect: "ops.login" }, async () => err(Denied.make({})));
const denyApi = guard({}, async () => err(Denied.make({})));
const ctx = () => createCtx({ mode: "sim", seed: SEED });
const boot = (routes: RouteTable, adapter: "node" | "client" | "static" = "node") =>
  createApp({
    topology: topology({ web: { modules: ["api", "ops"], adapter } }),
    routes,
    ctx: ctx(),
    mode: "production",
  });
const req = (method: string, path: string, init: RequestInit = {}) =>
  new Request(`${BASE}${path}`, { method, ...init });
const form = (fields: Record<string, string>): FormData => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
};

const opsC = contract("ops", { "ops.home": { path: "/" }, "ops.login": { path: "/login" } });
const pageWrite = action(opsC, "ops.home", { input: Note }, async () => ok(null));
const ops = manifest(opsC, { "ops.home": { component: page, POST: pageWrite }, "ops.login": { component: page } });

const apiC = contract("api", {
  "api.n": { method: "GET", path: "/api/n", output: N },
  "api.addN": { method: "POST", path: "/api/n", body: Note, output: Nothing },
  "api.w": { method: "POST", path: "/api/w", body: Note, output: Nothing },
  "api.patchW": { method: "PATCH", path: "/api/w", body: Note, output: Nothing },
  "api.one": { method: "GET", path: "/api/one/:n", params: N, output: N },
  "api.to": { method: "GET", path: "/api/to", output: N },
  "api.bare": { method: "GET", path: "/api/bare", output: N },
  "api.bareAdd": { method: "POST", path: "/api/bare", body: Note, output: Nothing },
});
const three = async () => ok({ n: 3 });
const none = async () => ok({});
const api = manifest(apiC, {
  "api.n": { loader: loader(apiC, "api.n", {}, three) },
  "api.addN": { action: action(apiC, "api.addN", {}, none) },
  "api.w": { action: action(apiC, "api.w", {}, none) },
  "api.patchW": { action: action(apiC, "api.patchW", {}, none) },
  "api.one": { loader: loader(apiC, "api.one", {}, three) },
  "api.to": { loader: loader(apiC, "api.to", {}, three), guard: denyTo },
  "api.bare": { loader: loader(apiC, "api.bare", {}, three), guard: denyApi },
  "api.bareAdd": { action: action(apiC, "api.bareAdd", {}, none), guard: denyApi },
});
const routes = routeTable(api, ops);

describe("API routes", () => {
  it("GET and HEAD answer JSON for a document accept; a page beside it still renders HTML", async () => {
    const app = await boot(routes);
    const res = await app.fetch(req("GET", "/api/n", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: "api.n", results: { "api.n": { ok: true, value: { n: 3 } } } });
    const head = await app.fetch(req("HEAD", "/api/n"));
    expect(head.status).toBe(200);
    expect(head.headers.get("content-type") ?? "").toContain("application/json");
    expect(await head.text()).toBe("");
    const home = await app.fetch(req("GET", "/", { headers: { accept: "text/html" } }));
    expect(home.headers.get("content-type") ?? "").toContain("text/html");
  });

  it("a pattern with write entries only answers GET, HEAD, OPTIONS and a missing verb 405 listing its methods", async () => {
    const app = await boot(routes);
    for (const method of ["GET", "HEAD", "OPTIONS", "DELETE"]) {
      const res = await app.fetch(req(method, "/api/w"));
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, PATCH");
    }
  });

  it("a pattern with a GET and a POST entry answers a PUT 405 listing GET, HEAD and POST", async () => {
    const res = await (await boot(routes)).fetch(req("PUT", "/api/n"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST");
  });

  it("a form POST gets the Result as JSON, never 303; an invalid body is 422 keel.fields at `body.<field>`", async () => {
    const app = await boot(routes);
    const res = await app.fetch(req("POST", "/api/w", { body: form({ note: "hello" }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.json()).toEqual({ ok: true, value: {} });
    const bad = await app.fetch(req("POST", "/api/w", { body: form({ note: "x" }) }));
    expect(bad.status).toBe(422);
    expect(bad.headers.get("content-type") ?? "").toContain("application/json");
    expect(await bad.json()).toMatchObject({
      ok: false,
      error: { code: "keel.fields", data: { "body.note": expect.any(String) } },
    });
  });

  it("a denying guard is 403 keel.denied with and without redirect, for reads and writes", async () => {
    const app = await boot(routes);
    for (const r of [
      req("GET", "/api/to", { headers: { accept: "text/html" } }),
      req("GET", "/api/bare"),
      req("POST", "/api/bare", { body: form({ note: "hello" }) }),
    ]) {
      const res = await app.fetch(r);
      expect(res.status).toBe(403);
      expect(res.headers.get("location")).toBeNull();
      expect(await res.json()).toMatchObject({ ok: false, error: { code: "keel.denied" } });
    }
  });

  it("an API entry with param failure is 404 as JSON", async () => {
    const res = await (await boot(routes)).fetch(req("GET", "/api/one/x", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "keel.notFound" } });
  });

  it("createApp throws E1511 for a client or static deployable serving an API entry; node serves it", async () => {
    for (const adapter of ["client", "static"] as const)
      await expect(boot(routes, adapter)).rejects.toMatchObject({ code: "E1511" });
    await expect(boot(routes, "node")).resolves.toBeDefined();
    // Only the served deployable's modules count: the API module lives in a node deployable.
    const split = topology({
      web: { modules: ["ops"], adapter: "client" },
      srv: { modules: ["api"], adapter: "node" },
    });
    await expect(createApp({ topology: split, routes, ctx: ctx(), deployable: "web" })).resolves.toBeDefined();
  });

  it("405 `allow` lists a page's GET, HEAD and exactly its bound verbs, in method order", async () => {
    const verbs = ["POST", "PUT", "PATCH", "DELETE"] as const;
    const c = contract("ops", { "ops.x": { path: "/x" } });
    const act = action(c, "ops.x", { input: Nothing }, async () => ok(null));
    await fc.assert(
      fc.asyncProperty(fc.subarray([...verbs]), async (bound) => {
        const has = (v: (typeof verbs)[number]) => (bound.includes(v) ? { [v]: act } : {});
        const m = manifest(c, {
          "ops.x": { component: page, ...has("POST"), ...has("PUT"), ...has("PATCH"), ...has("DELETE") },
        });
        const app = await createApp({
          topology: topology({ web: { modules: ["ops"], adapter: "node" } }),
          routes: m,
          ctx: ctx(),
        });
        const res = await app.fetch(req("OPTIONS", "/x"));
        expect(res.status).toBe(405);
        expect(res.headers.get("allow")).toBe(["GET", "HEAD", ...verbs.filter((v) => bound.includes(v))].join(", "));
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a page answers OPTIONS with 405 allowing GET, HEAD and its action methods", async () => {
    const res = await (await boot(routes)).fetch(req("OPTIONS", "/"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST");
  });

  it("a guard redirect naming an API entry is E1508", async () => {
    const c = contract("ops", {
      "ops.n": { method: "GET", path: "/api/n", output: N },
      "ops.home": { path: "/" },
    });
    const toApi = guard({ redirect: "ops.n" }, async () => err(Denied.make({})));
    const served = async () =>
      createApp({
        topology: topology({ web: { modules: ["ops"], adapter: "node" } }),
        routes: manifest(c, {
          "ops.n": { loader: loader(c, "ops.n", {}, async () => ok({ n: 1 })) },
          "ops.home": { component: page, guard: toApi },
        }),
        ctx: ctx(),
      });
    await expect(served()).rejects.toMatchObject({ code: "E1508" });
  });
});
