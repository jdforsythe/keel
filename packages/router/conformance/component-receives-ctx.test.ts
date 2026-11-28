// @vitest-environment happy-dom
// k.router (Manifest) "`component` receives `{ params, search, data }` and a ctx: in a browser the router's, on the server the `createApp({ ctx })` object itself, the one its loaders get"; RFC 0162 D5 "route `component` and `errorElement` are components: both get `(props, ctx)`."
// RFC 0162 Conformance diff: "A route page and its `errorElement` receive the router's ctx." Seed 1337.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { createRouter, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, memoryHistory, settle } from "./contract-support.ts";

const Broken = s.error("a.broken", s.object({}));
const c = contract("a", {
  "a.home": { path: "/" },
  "a.bad": { path: "/bad" },
  "a.plain": { path: "/plain" },
});

const rig = (at: string) => {
  const seen: { where: string; ctx: Ctx }[] = [];
  const note = (where: string, ctx: Ctx): Node => {
    seen.push({ where, ctx });
    const el = document.createElement("section");
    el.setAttribute("data-where", where);
    return el;
  };
  const loadBad = loader(c, "a.bad", { output: s.object({}) }, async () => err(Broken.make({})));
  const routes = manifest(c, {
    "a.home": { component: (_p, ctx) => note("home", ctx) },
    "a.bad": {
      component: (_p, ctx) => note("bad", ctx),
      loader: loadBad,
      errorElement: (_p, ctx) => note("error", ctx),
    },
    // a pure view: no second parameter
    "a.plain": { component: () => document.createElement("p") },
  });
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const router = createRouter(routes, { ctx, history: memoryHistory(at) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  return { seen, ctx, host, stop: () => (unmount(), router.dispose(), host.remove()) };
};

describe("k.router: components get the router's ctx", () => {
  it("A route page receives the router's ctx", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constant("/"), async (at) => {
        const r = rig(at);
        await settle();
        const home = r.seen.find((x) => x.where === "home");
        expect(home?.ctx).toBe(r.ctx);
        r.stop();
      }),
      { seed: SEED, numRuns: 2 },
    );
  });

  it("a route's `errorElement` receives the router's ctx", async () => {
    const r = rig("/bad");
    await settle();
    const shown = r.seen.find((x) => x.where === "error");
    expect(shown?.ctx).toBe(r.ctx);
    expect(r.seen.some((x) => x.where === "bad")).toBe(false);
    r.stop();
  });

  it("a component declared with no second parameter renders unchanged under the router", async () => {
    const r = rig("/plain");
    await settle();
    expect(r.host.querySelector("p")).not.toBeNull();
    r.stop();
  });
});
