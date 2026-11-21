// @vitest-environment happy-dom
// Spec: RFC 0162 Conformance diff: "A route page and its `errorElement` receive the router's ctx; a server-rendered page the `createApp({ ctx })` object itself (`===`), the one its loader gets" and k.component "every caller (runtime root, router, server render, harness, JSX parent) passes `ctx`". Seed 1337.
// The page records the second argument it was called with; the app was created with one sim ctx.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, boot, getHtml } from "./contract-support.ts";

const c = contract("a", { "a.home": { path: "/" }, "a.pure": { path: "/pure" } });
const seen: Ctx[] = [];
const Home = (_p: unknown, ctx: Ctx): Node => {
  seen.push(ctx);
  const main = document.createElement("main");
  main.textContent = "home";
  return main;
};
const routes = manifest(c, {
  "a.home": { component: Home, loader: loader(c, "a.home", { output: s.object({}) }, async () => ok({})) },
  // a pure view declares no ctx
  "a.pure": { component: () => document.createElement("main") },
});

describe("k.server: the render passes the app's ctx to a page", () => {
  it("A server-rendered page receives a ctx second", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/", "/?x=1"), async (url) => {
        seen.length = 0;
        const ctx = createCtx({ mode: "sim", seed: SEED });
        const app = await boot(routes, ["a"], "node", ctx);
        const res = await app.fetch(getHtml(url));
        expect(res.status).toBe(200);
        expect(seen.length).toBeGreaterThanOrEqual(1);
        for (const given of seen) expect(given).toBe(ctx);
      }),
      { seed: SEED, numRuns: 4 },
    );
  });

  it("a page declared with no second parameter renders unchanged", async () => {
    const app = await boot(routes, ["a"]);
    const res = await app.fetch(getHtml("/pure"));
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("<main");
  });
});
