// @vitest-environment happy-dom
// Spec: k.api (RFC 0086), Conformance clauses 5-9. Seed 1337: no generated input beyond fixed fc picks.
// ASSUMPTION: createApp throws (rejects with a message mentioning the code) as e1553-static-params.test.ts assumes.
import { createCtx } from "@keel/ctx";
import { action, guard, loader, manifest } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, get, post, SEED } from "./fixtures.ts";
import { createAppLoose, simCtx } from "./topology-fixtures.ts";

const Out = s.object({ n: s.int() });
const Denied = s.error("keel.denied", s.object({}));
const page = (): Node => document.createElement("main");
const read = loader({ output: Out }, async () => ok({ n: 7 }));
const write = action({ input: s.object({ note: s.string() }) }, async () => ok(null));
const deny = guard({ redirect: "ops.login" }, async () => err(Denied.make({})));
const topo = topology({ web: { modules: ["api", "ops"], adapter: "node" } });
const boot = (routes: Parameters<typeof createApp>[0]["routes"]) =>
  createApp({ topology: topo, routes, ctx: createCtx({ mode: "sim", seed: SEED }), mode: "production" });

describe("k.api", () => {
  it("A GET with `accept: text/html` to an API route with a loader gets the JSON body and status a runtime GET gets.", async () => {
    const routes = manifest({
      "api.lists": { api: true, path: "/api/lists", loader: read },
      "ops.home": { path: "/", component: page },
    });
    const app = await boot(routes);
    const runtime = await app.fetch(get("/api/lists", { accept: "application/json" }));
    expect(runtime.status).toBe(200);
    const expected: unknown = await runtime.json();
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("text/html", "text/html,application/xhtml+xml", "*/*"), async (accept) => {
        const res = await app.fetch(get("/api/lists", { accept }));
        expect(res.status).toBe(runtime.status);
        expect(res.headers.get("content-type") ?? "").toContain("application/json");
        expect(await res.json()).toEqual(expected);
      }),
      { seed: SEED, numRuns: 10 },
    );
  });

  it("A GET to an API route without a loader is 405 with `allow` listing its action methods.", async () => {
    const routes = manifest({
      "api.lists": { api: true, path: "/api/lists" },
      "ops.home": { path: "/", component: page },
    });
    routes.actions({ "api.lists": { POST: write, DELETE: write } });
    const app = await boot(routes);
    const res = await app.fetch(get("/api/lists", { accept: "application/json" }));
    expect(res.status).toBe(405);
    const allow = (res.headers.get("allow") ?? "").split(",").map((m) => m.trim());
    expect(allow.sort()).toEqual(expect.arrayContaining(["DELETE", "POST"]));
    expect(allow).not.toContain("GET");
  });

  it("A form POST to an API route gets the action's `Result` as JSON with no `Location`.", async () => {
    const routes = manifest({
      "api.lists": { api: true, path: "/api/lists" },
      "ops.home": { path: "/", component: page },
    });
    routes.actions({ "api.lists": { POST: write } });
    const app = await boot(routes);
    const res = await app.fetch(post("/api/lists", { note: "hi" }));
    expect(res.status).not.toBe(303);
    expect(res.headers.get("location")).toBeNull();
    expect(res.headers.get("content-type") ?? "").toContain("application/json");
    expect(await res.json()).toEqual(expect.objectContaining({ ok: true }));
  });

  it("A denying guard with a `redirect` answers 403 `keel.denied` and no `Location`.", async () => {
    const routes = manifest({
      "ops.login": { path: "/login", component: page },
      "api.lists": { api: true, path: "/api/lists", loader: read, guard: deny },
    });
    const app = await boot(routes);
    const res = await app.fetch(get("/api/lists", { accept: "text/html" }));
    expect(res.status).toBe(403);
    expect(res.headers.get("location")).toBeNull();
    expect(JSON.stringify(await res.json())).toContain("keel.denied");
  });

  it("`createApp` for a `client` deployable serving an API route throws E1511.", async () => {
    const routes = manifest({
      "api.lists": { api: true, path: "/api/lists", loader: read },
      "ops.home": { path: "/", component: page },
    });
    const run = (adapter: "client" | "node") =>
      createAppLoose({ topology: topology({ web: { modules: ["api", "ops"], adapter } }), routes, ctx: simCtx() }).then(
        () => "built",
        (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
      );
    expect(await run("client")).toContain("E1511");
    expect(await run("node")).toBe("built");
  });
});
