// @vitest-environment happy-dom
// Spec: k.routes, Conformance clause 10 (served half): "the page renders inside `app.frame`'s component" for a page of `shop` bound with `layout: 'app.frame'`.
// Seed 1337 (no random input: fixed modules).
// Not yet built (rfc:0187): `test.skip` with the check-side cases of the same clause (the router already serves this chain); remove the `.skip` in the build that relaxes E1152.
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

test.skip("a page of `shop` bound with `layout: 'app.frame'` renders inside `app.frame`'s component", async () => {
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
