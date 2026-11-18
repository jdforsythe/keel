// @vitest-environment happy-dom
// Examples: the router passes ctx as every component's third argument; Form and layouts take RFC 0008 children.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { ok, s } from "@keel/schema";
import { expect, it } from "vitest";
import { Form } from "../src/Form.ts";
import { action } from "../src/action.ts";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import { memoryHistory } from "./memoryHistory.ts";
import { to } from "./to.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const el = (name: string, kids: Node[] = []): HTMLElement => {
  const e = document.createElement("div");
  e.setAttribute("data-x", name);
  e.append(...kids);
  return e;
};

it("passes ctx as the third argument to layouts and pages", async () => {
  const ctx = createCtx({ mode: "sim" });
  const routes = manifest({
    "cx.shell": {
      component: (p, _slots, c) =>
        el("shell", [document.createTextNode(`L${c?.clock.now()}`), p.children?.() ?? el("")]),
    },
    "cx.page": {
      path: "/cx",
      layout: "cx.shell",
      component: (_p, _slots, c) => el("page", [document.createTextNode(String(c?.clock.now()))]),
    },
  });
  const history = memoryHistory("/cx");
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  await settle();
  expect(host.querySelector('[data-x="page"]')?.textContent).toBe("0");
  expect(host.querySelector('[data-x="shell"]')?.textContent).toBe("L00");
  unmount();
  router.dispose();
});

const kid = (): HTMLSpanElement => {
  const child = document.createElement("span");
  child.setAttribute("data-x", "kid");
  return child;
};

const formRoutes = (id: string, kids: "node" | "array" | "text") => {
  const routes = manifest({
    [id]: {
      path: `/${id}`,
      component: () => {
        const children = kids === "node" ? () => kid() : kids === "array" ? () => [kid()] : () => "hi";
        return Form({ method: "POST", action: to(`/${id}`), children });
      },
    },
  });
  routes.actions({ [id]: { POST: action({ input: s.object({}) }, async () => ok(null)) } });
  return routes;
};

it.each(["node", "array", "text"] as const)("Form renders a thunk of %s children", async (kind) => {
  const id = `fc.${kind}`;
  const router = createRouter(formRoutes(id, kind), {
    ctx: createCtx({ mode: "sim" }),
    history: memoryHistory(`/${id}`),
  });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  await settle();
  const form = host.querySelector("form");
  expect(form).not.toBeNull();
  if (kind === "text") expect(form?.textContent).toBe("hi");
  else expect(form?.querySelectorAll('[data-x="kid"]')).toHaveLength(1);
  unmount();
  router.dispose();
});

it("clicks on same-origin links inside the App navigate client-side", async () => {
  const routes = manifest({
    "lk.a": {
      path: "/lk/a",
      component: () => el("a", [Object.assign(document.createElement("a"), { href: "/lk/b" })]),
    },
    "lk.b": { path: "/lk/b", component: () => el("b") },
  });
  const history = memoryHistory("/lk/a");
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host);
  await settle();
  let unloaded = false;
  const onUnload = (): void => {
    unloaded = true;
  };
  window.addEventListener("beforeunload", onUnload);
  const mod = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
  host.querySelector("a")?.dispatchEvent(mod);
  expect(mod.defaultPrevented).toBe(false);
  const link = host.querySelector("a");
  const ev = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 });
  link?.dispatchEvent(ev);
  await settle();
  expect(ev.defaultPrevented).toBe(true);
  expect(router.route.get().id).toBe("lk.b");
  expect(history.current()).toBe("/lk/b");
  expect(unloaded).toBe(false);
  window.removeEventListener("beforeunload", onUnload);
  unmount();
  router.dispose();
  host.remove();
});
