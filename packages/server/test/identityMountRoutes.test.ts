// @vitest-environment node
// A `:param` route that would fit `handle.path` is legitimate (k.user E1579 names literal paths only): createApp
// starts, a request under the mount reaches `handle.fn` and never the page, and a path beside it reaches the page.
// Seed 1337.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { s } from "@keel/schema";
import { createApp, identity, topology } from "@keel/server";
import { describe, expect, it } from "vitest";

const boot = () =>
  createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes: manifest({
      "app.page": {
        path: "/:locale/:slug",
        params: s.object({ locale: s.string(), slug: s.string() }),
        component: () => document.createElement("p"),
      },
    }),
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
    identity: identity({
      identify: async () => "",
      handle: { path: "/api/auth", fn: () => new Response("from-handle", { headers: { "x-from": "handle" } }) },
    }),
  });

describe("createApp with handle.path /api/auth beside /:locale/:slug", () => {
  it("starts, and a GET under the mount reaches handle.fn, not the page", async () => {
    const app = await boot();
    for (const at of ["/api/auth", "/api/auth/session"]) {
      const res = await app.fetch(new Request(`http://localhost${at}`));
      expect(res.headers.get("x-from")).toBe("handle");
      expect(await res.text()).toBe("from-handle");
    }
  });

  it("serves the page at a path beside the mount", async () => {
    const res = await (await boot()).fetch(new Request("http://localhost/en/about"));
    expect(res.headers.get("x-from")).toBeNull();
    expect(res.status).toBe(200);
  });
});
