// @vitest-environment happy-dom
// A page action on a static deployable is refused at createApp (E1553); a page with no action there answers a POST 405.
import { createCtx } from "@keel/ctx";
import { action, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";

const page = (): Node => document.createElement("p");
const c = contract("app", { "app.home": { path: "/" } });
const save = action(c, "app.home", { input: s.object({}) }, async () => ok(null));

describe("page actions and the deployable", () => {
  it("a POST to a page without an action on a static deployable is 405 with nothing run", async () => {
    const app = await createApp({
      topology: topology({ web: { modules: ["app"], adapter: "static" } }),
      routes: manifest(c, { "app.home": { component: page } }),
      ctx: createCtx({ mode: "sim", seed: 1337 }),
    });
    const res = await app.fetch(
      new Request("http://localhost/", { method: "POST", headers: { "sec-fetch-site": "same-origin" } }),
    );
    expect(res.status).toBe(405);
  });

  it("a page with an action is E1553 on a static deployable and boots on a node one", async () => {
    const routes = manifest(c, { "app.home": { component: page, POST: save } });
    await expect(
      createApp({
        topology: topology({ web: { modules: ["app"], adapter: "static" } }),
        routes,
        ctx: createCtx({ mode: "sim", seed: 1337 }),
      }),
    ).rejects.toThrow(/^E1553/);
    await expect(
      createApp({
        topology: topology({ web: { modules: ["app"], adapter: "node" } }),
        routes,
        ctx: createCtx({ mode: "sim", seed: 1337 }),
      }),
    ).resolves.toBeDefined();
  });
});
