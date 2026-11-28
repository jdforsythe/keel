// @vitest-environment happy-dom
// k.router Client scroll on `replace` and with a hash: a search-only `replace` keeps scroll as a search-only push does;
// a `replace` to another route goes to the top.
import { createCtx } from "@keel/ctx";
import { createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import fc from "fast-check";
import { beforeEach, describe, expect, it } from "vitest";
import { memoryHistory } from "./memoryHistory.ts";

const SEED = 1337;
const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const app = contract("app", {
  "app.home": { path: "/" },
  "app.ordersList": { path: "/orders", search: s.object({ page: s.int({ min: 0, max: 1000 }).optional() }) },
});
const routes = manifest(app, {
  "app.home": { component: () => document.createElement("main") },
  "app.ordersList": { component: () => document.createElement("section") },
});

const start = async (at: string) => {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const router = createRouter(routes, { ctx, history: memoryHistory(at) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  await settle();
  return {
    router,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
};

describe("scroll on replace", () => {
  beforeEach(() => {
    window.scrollTo(0, 0);
  });

  it("a search-only replace keeps the scroll position", async () => {
    const t = await start("/orders");
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 5000 }), fc.integer({ min: 0, max: 1000 }), async (y, page) => {
        window.scrollTo(0, y);
        await t.router.navigate(app.href("app.ordersList", {}, { page }), { replace: true });
        await settle();
        expect(t.router.route.get()).toMatchObject({ id: "app.ordersList", search: { page } });
        expect(window.scrollY).toBe(y);
      }),
      { seed: SEED, numRuns: 10 },
    );
    t.stop();
  });

  it("a replace to another route goes to the top", async () => {
    const t = await start("/");
    window.scrollTo(0, 300);
    await t.router.navigate(app.href("app.ordersList"), { replace: true });
    await settle();
    expect(window.scrollY).toBe(0);
    t.stop();
  });
});
