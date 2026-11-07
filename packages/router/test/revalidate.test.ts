// @vitest-environment happy-dom
// Example: ok(null) revalidation re-commits when the current page shows a loader error and loaders now succeed.
import { createCtx } from "@keel/ctx";
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
  const routes = manifest({
    "rv.page": {
      path: "/rv",
      loader: loader({ output: s.object({}) }, async () => (state.fail ? err(Gone.make({})) : ok({}))),
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
  routes.actions({
    "rv.page": {
      POST: action({ input: s.object({}) }, async () => {
        state.fail = false;
        return ok(null);
      }),
    },
  });
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory("/rv") });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
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
