// @vitest-environment happy-dom
// Example: ok(null) revalidation re-commits when the current page shows a loader error and loaders now succeed.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, ok, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const Gone = s.error("rv.gone", s.object({}));

it("a page showing its errorElement renders the component after ok(null) when the loader recovers", async () => {
  const state = { fail: true };
  const rv = contract("rv", { "rv.page": { path: "/rv" } });
  const routes = manifest(rv, {
    "rv.page": {
      loader: loader(rv, "rv.page", { output: s.object({}) }, async () => (state.fail ? err(Gone.make({})) : ok({}))),
      POST: action(rv, "rv.page", { input: s.object({}) }, async () => {
        state.fail = false;
        return ok(null);
      }),
      component: () => {
        const p = document.createElement("p");
        p.id = "page";
        return p;
      },
      errorElement: ({ error }) => {
        const box = document.createElement("div");
        box.id = "failed";
        box.append(error.code, Form({ method: "POST", action: to("/rv") }));
        return box;
      },
    },
  });
  const ctx = createCtx({ mode: "sim" });
  const router = createRouter(routes, { ctx, history: memoryHistory("/rv") });
  const host = document.createElement("div");
  const unmount = mount(router.App, host, { ctx });
  await settle();
  expect(host.querySelector("#failed")?.textContent).toBe("rv.gone");
  host.querySelector("form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  await settle();
  expect(host.querySelector("#failed")).toBeNull();
  expect(host.querySelector("#page")).not.toBeNull();
  expect(router.route.get()).toEqual({ id: "rv.page", params: {}, search: {}, pending: false });
  unmount();
  router.dispose();
});
