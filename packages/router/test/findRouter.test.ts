// @vitest-environment happy-dom
// `findRouter` (`@keel/router/internal`) gives a component rendered by a router its `ctx` and its `navigate`.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { findRouter } from "../src/internal/index.ts";
import type { RouterCore } from "../src/internal/index.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};

it("a page finds its router's ctx and navigates through it, push or replace", async () => {
  const found: (RouterCore | null)[] = [];
  const fr = contract("fr", { "fr.list": { path: "/fr", search: s.object({ q: s.string().optional() }) } });
  const routes = manifest(fr, {
    "fr.list": {
      component: () => {
        found.push(findRouter());
        return document.createElement("p");
      },
    },
  });
  const ctx = createCtx({ mode: "sim" });
  const history = memoryHistory("/fr");
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  const unmount = mount(router.App, host, { ctx });
  await settle();
  const core = found[0];
  if (core === null || core === undefined) throw new Error("no router found");
  expect(core.ctx).toBe(ctx);
  await core.navigate(fr.href("fr.list", {}, { q: "a" }), { replace: true });
  await settle();
  expect(router.route.get()).toMatchObject({ id: "fr.list", search: { q: "a" } });
  expect(history.entries).toEqual(["/fr?q=a"]);
  await core.navigate(fr.href("fr.list", {}, { q: "b" }));
  await settle();
  expect(router.route.get()).toMatchObject({ search: { q: "b" } });
  expect(history.entries).toEqual(["/fr?q=a", "/fr?q=b"]);
  expect(findRouter()).toBe(core);
  unmount();
  expect(findRouter()).toBeNull();
  router.dispose();
});
