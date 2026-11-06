// @vitest-environment happy-dom
// Examples: the 404 layout rule (k.router Matching) and Form finding its router through the owner chain.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteDef } from "../src/types/RouteDef.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const tag = (name: string, kids: Node[] = []): HTMLElement => {
  const e = document.createElement("div");
  e.setAttribute("data-x", name);
  e.append(...kids);
  return e;
};
const page = (shell: Partial<RouteDef>, prefix: string) =>
  manifest({
    [`${prefix}.shell`]: { component: (p) => tag("shell", p.children === undefined ? [] : [p.children()]), ...shell },
    [`${prefix}.page`]: {
      path: `/${prefix}/:n`,
      params: s.object({ n: s.int() }),
      layout: `${prefix}.shell`,
      component: () => tag("page"),
      errorElement: ({ error }) => tag(`error:${error.code}`),
    },
  });

it.each<[string, Partial<RouteDef>, boolean]>([
  ["no loader or guard above: the errorElement renders inside the layouts", {}, true],
  [
    "a layout with a loader: the errorElement renders alone",
    { loader: loader(s.object({}), async () => ok({})) },
    false,
  ],
  ["a layout with a guard: the errorElement renders alone", { guard: "nf.never" }, false],
])("params failure, %s", async (_, shell, inside) => {
  const prefix = `nf${Object.keys(shell).join("")}`;
  const routes = page(shell, prefix);
  const history = memoryHistory("/nowhere");
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  history.pop(`/${prefix}/abc`);
  await settle();
  expect(host.querySelector('[data-x="error:keel.notFound"]')).not.toBeNull();
  expect(host.querySelector('[data-x="shell"] [data-x="error:keel.notFound"]') !== null).toBe(inside);
  expect(host.querySelector('[data-x="page"]')).toBeNull();
  expect(router.route.get()).toEqual({ id: null, params: {}, search: {}, pending: false });
  unmount();
  router.dispose();
});

it("Form outside any router render is a native form: submit is not intercepted", () => {
  manifest({
    "nat.a": { path: "/nat", actions: { POST: action(s.object({}), async () => ok(null)) }, component: () => tag("p") },
  });
  const form = Form({ method: "POST", action: "nat.a" });
  const e = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(false);
  expect(form.getAttribute("action")).toBe("/nat");
});
