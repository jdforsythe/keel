// @vitest-environment happy-dom
// Spec: k.routes, clause "With module `app` (deps `['shop']`) holding a layout `app.frame` and module `shop` (deps `[]`) a page bound with `layout: 'app.frame'`, `keel check` reports no E1152 and no E1153 and the page renders inside `app.frame`'s component; with `app`'s `deps` `[]` as well, one E1152 at `layout`."
// Seed 1337 (no random input: fixed modules).
import { type RouteProps, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { expect, test } from "vitest";
import { page, settle, startRouter } from "./contract-support.ts";

const wrap = (p: RouteProps) => {
  const e = document.createElement("div");
  e.setAttribute("data-layout", "app.frame");
  if (p.children !== undefined) e.append(p.children());
  return e;
};

const appC = contract("app", { "app.frame": { layout: true } });
const shopC = contract("shop", { "shop.home": { path: "/" } });
const appM = manifest(appC, { "app.frame": { component: wrap } });
const shopM = manifest(shopC, { "shop.home": { component: page, layout: "app.frame" } });

test("a page of `shop` bound with `layout: 'app.frame'` renders inside `app.frame`'s component", async () => {
  const { router, ctx } = startRouter(routeTable(appM, shopM), "/");
  const host = document.createElement("div");
  document.body.append(host);
  const { mount } = await import("@keel/runtime-dom");
  const stop = mount(router.App, host, { ctx });
  await settle();
  const frame = host.querySelector('[data-layout="app.frame"]');
  expect(frame?.querySelector("section")).not.toBeNull();
  stop();
  router.dispose();
});
