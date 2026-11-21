// @vitest-environment happy-dom
// Examples: the 404 layout rule (k.router Matching) and Form finding its router through the owner chain.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { guard } from "../src/guard.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const tag = (name: string, kids: Node[] = []): HTMLElement => {
  const e = document.createElement("div");
  e.setAttribute("data-x", name);
  e.append(...kids);
  return e;
};
type Above = "none" | "loader" | "guard";
const page = (above: Above) => {
  const c = contract("nf", {
    "nf.shell": { layout: true },
    "nf.page": { path: "/nf/:n", params: s.object({ n: s.int() }) },
  });
  const shell = {
    component: (p: { children?: () => Node }) => tag("shell", p.children === undefined ? [] : [p.children()]),
    ...(above === "loader" ? { loader: loader(c, "nf.shell", { output: s.object({}) }, async () => ok({})) } : {}),
    ...(above === "guard" ? { guard: guard({ redirect: "nf.never" }, async () => ok(null)) } : {}),
  };
  return manifest(c, {
    "nf.shell": shell,
    "nf.page": {
      layout: "nf.shell",
      component: () => tag("page"),
      errorElement: ({ error }) => tag(`error:${error.code}`),
    },
  });
};

it.each<[string, Above, boolean]>([
  ["no loader or guard above: the errorElement renders inside the layouts", "none", true],
  ["a layout with a loader: the errorElement renders alone", "loader", false],
  ["a layout with a guard: the errorElement renders alone", "guard", false],
])("params failure, %s", async (_, above, inside) => {
  const routes = page(above);
  const history = memoryHistory("/nowhere");
  const ctx = createCtx({ mode: "sim" });
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  const unmount = mount(router.App, host, { ctx });
  history.pop("/nf/abc");
  await settle();
  expect(host.querySelector('[data-x="error:keel.notFound"]')).not.toBeNull();
  expect(host.querySelector('[data-x="shell"] [data-x="error:keel.notFound"]') !== null).toBe(inside);
  expect(host.querySelector('[data-x="page"]')).toBeNull();
  expect(router.route.get()).toEqual({ id: null, params: {}, search: {}, pending: false });
  unmount();
  router.dispose();
});

it("Form outside any router render is a native form posting to its Href: submit is not intercepted", () => {
  const form = Form({ method: "POST", action: to("/nat") });
  const e = new Event("submit", { bubbles: true, cancelable: true });
  form.dispatchEvent(e);
  expect(e.defaultPrevented).toBe(false);
  expect(form.getAttribute("action")).toBe("/nat");
});
