// @vitest-environment happy-dom
// Examples (k.api): an API route answers JSON whatever `accept` says; HEAD, 405 `allow`, guard 403 with and without
// `redirect`, a form POST's `Result` JSON, 422 as JSON, E1511 for `client` and `static` deployables.
import { createCtx } from "@keel/ctx";
import { type Manifest, type RouteDef, action, guard, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { allowOf } from "../src/internal/allowOf.ts";

const SEED = 1337;
const BASE = "http://localhost";
const Denied = s.error("keel.denied", s.object({}));
const page = (): Node => document.createElement("main");
const read = loader({ output: s.object({ n: s.int() }) }, async () => ok({ n: 3 }));
const write = action({ input: s.object({ note: s.string({ min: 2 }) }), output: s.object({}) }, async () => ok({}));
const pageWrite = action({ input: s.object({ note: s.string({ min: 2 }) }) }, async () => ok(null));
const denyTo = guard({ redirect: "ops.login" }, async () => err(Denied.make({})));
const denyApi = guard({}, async () => err(Denied.make({})));
const ctx = () => createCtx({ mode: "sim", seed: SEED });
const boot = (routes: Manifest<Readonly<Record<string, RouteDef>>>, adapter: "node" | "client" | "static" = "node") =>
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

describe("API routes", () => {
  it("GET and HEAD answer JSON for a document accept; a page beside it still renders HTML", async () => {
    const routes = manifest({
      "api.n": { api: true, path: "/api/n", loader: read },
      "ops.home": { path: "/", component: page },
    });
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

  it("without a loader GET and HEAD are 405 listing only action methods; a missing verb lists them too", async () => {
    const routes = manifest({ "api.w": { api: true, path: "/api/w" }, "ops.home": { path: "/", component: page } });
    routes.actions({ "api.w": { POST: write, PATCH: write } });
    const app = await boot(routes);
    for (const method of ["GET", "HEAD", "OPTIONS"]) {
      const res = await app.fetch(req(method, "/api/w"));
      expect(res.status).toBe(405);
      expect(res.headers.get("allow")).toBe("POST, PATCH");
    }
    const del = await app.fetch(req("DELETE", "/api/w"));
    expect(del.status).toBe(405);
    expect(del.headers.get("allow")).toBe("POST, PATCH");
  });

  it("with a loader and actions, 405 lists GET, HEAD and the action methods", async () => {
    const routes = manifest({
      "api.n": { api: true, path: "/api/n", loader: read },
      "ops.home": { path: "/", component: page },
    });
    routes.actions({ "api.n": { POST: write } });
    const app = await boot(routes);
    const res = await app.fetch(req("PUT", "/api/n"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST");
  });

  it("a form POST gets the Result as JSON, never 303; invalid input is 422 keel.fields as JSON", async () => {
    const routes = manifest({ "api.w": { api: true, path: "/api/w" }, "ops.home": { path: "/", component: page } });
    routes.actions({ "api.w": { POST: write } });
    const app = await boot(routes);
    const res = await app.fetch(req("POST", "/api/w", { body: form({ note: "hello" }) }));
    expect(res.status).toBe(200);
    expect(res.headers.get("location")).toBeNull();
    expect(await res.json()).toEqual({ ok: true, value: {} });
    const bad = await app.fetch(req("POST", "/api/w", { body: form({ note: "x" }) }));
    expect(bad.status).toBe(422);
    expect(bad.headers.get("content-type") ?? "").toContain("application/json");
    expect(await bad.json()).toMatchObject({ ok: false, error: { code: "keel.fields" } });
  });

  it("a denying guard is 403 keel.denied with and without redirect, for reads and writes", async () => {
    const routes = manifest({
      "ops.login": { path: "/login", component: page },
      "api.to": { api: true, path: "/api/to", loader: read, guard: denyTo },
      "api.bare": { api: true, path: "/api/bare", loader: read, guard: denyApi },
    });
    routes.actions({ "api.bare": { POST: write } });
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

  it("an API route with param failure is 404 as JSON", async () => {
    const routes = manifest({
      "api.one": { api: true, path: "/api/one/:n", params: s.object({ n: s.int() }), loader: read },
      "ops.home": { path: "/", component: page },
    });
    const app = await boot(routes);
    const res = await app.fetch(req("GET", "/api/one/x", { headers: { accept: "text/html" } }));
    expect(res.status).toBe(404);
    expect(await res.json()).toMatchObject({ ok: false, error: { code: "keel.notFound" } });
  });

  it("createApp throws E1511 for a client or static deployable serving an API route; node serves it", async () => {
    const routes = manifest({
      "api.n": { api: true, path: "/api/n", loader: read },
      "ops.home": { path: "/", component: page },
    });
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

  it("allowOf lists GET and HEAD (unless an API route without a loader) then exactly the attached methods", () => {
    const verbs = ["POST", "PUT", "PATCH", "DELETE"] as const;
    fc.assert(
      fc.property(fc.subarray([...verbs]), fc.boolean(), fc.boolean(), (methods, withLoader, api) => {
        const entry = withLoader ? { path: "/x", loader: read } : { path: "/x" };
        const def = api ? { api: true as const, ...entry } : { ...entry, component: page };
        const routes = manifest({ "ops.x": def });
        // The verb set is drawn at run time, so the attach goes through the untyped call `routes.actions` makes.
        const byVerb = Object.fromEntries(methods.map((m) => [m, api ? write : pageWrite]));
        if (methods.length > 0) Reflect.apply(routes.actions, undefined, [{ "ops.x": byVerb }]);
        const reads = api && !withLoader ? [] : ["GET", "HEAD"];
        expect(allowOf(def)).toBe([...reads, ...methods].join(", "));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("a page answers OPTIONS with 405 allowing GET, HEAD and its action methods", async () => {
    const routes = manifest({
      "api.n": { api: true, path: "/api/n", loader: read },
      "ops.home": { path: "/", component: page },
    });
    routes.actions({ "ops.home": { POST: pageWrite } });
    const res = await (await boot(routes)).fetch(req("OPTIONS", "/"));
    expect(res.status).toBe(405);
    expect(res.headers.get("allow")).toBe("GET, HEAD, POST");
  });

  it("createApp throws E1508 for a guard redirect naming an API route, and manifest() E1510 for api other than true", async () => {
    const toApi = guard({ redirect: "api.n" }, async () => err(Denied.make({})));
    const routes = manifest({
      "api.n": { api: true, path: "/api/n", loader: read },
      "ops.home": { path: "/", component: page, guard: toApi },
    });
    await expect(boot(routes)).rejects.toMatchObject({ code: "E1508" });
    const entry = { api: 1, path: "/api/n", loader: read };
    expect(() => Reflect.apply(manifest, undefined, [{ "api.n": entry }])).toThrow(/^E1510 /);
  });
});
