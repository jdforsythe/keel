// @vitest-environment happy-dom
// Spec: k.testing Harness (`renderRoute`) and k.api: a page id renders; an API route's id is rejects. Seed: 1337.
import { loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import { renderRoute } from "@keel/testing";
import { expect, it } from "vitest";

const routes = manifest({
  "ra.api": { api: true, path: "/ra/api", loader: loader({ output: s.object({}) }, async () => ok({})) },
  "ra.home": { path: "/ra", component: () => document.createElement("main") },
});

it("renders a page id", async () => {
  const page = await renderRoute("ra.home", { routes });
  expect(page.route().id).toBe("ra.home");
  page.dispose();
});

it("rejects an API route id", async () => {
  await expect(renderRoute("ra.api", { routes })).rejects.toThrow();
});
