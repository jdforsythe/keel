// @vitest-environment happy-dom
// Examples: the router passes ctx as every component's second argument; Form and layouts take RFC 0008 children.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
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

it("passes ctx as the second argument to layouts and pages", async () => {
  const ctx = createCtx({ mode: "sim" });
  const cx = contract("cx", { "cx.shell": { layout: true }, "cx.page": { path: "/cx" } });
  const routes = manifest(cx, {
    "cx.shell": {
      component: (p, c) => el("shell", [document.createTextNode(`L${c.clock.now()}`), p.children?.() ?? el("")]),
    },
    "cx.page": {
      layout: "cx.shell",
      component: (_p, c) => el("page", [document.createTextNode(String(c.clock.now()))]),
    },
  });
  const history = memoryHistory("/cx");
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  const unmount = mount(router.App, host, { ctx });
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

const formRoutes = (kids: "node" | "array" | "text") => {
  const fc = contract("fc", { "fc.page": { path: "/fc" } });
  return manifest(fc, {
    "fc.page": {
      component: () => {
        const children = kids === "node" ? () => kid() : kids === "array" ? () => [kid()] : () => "hi";
        return Form({ method: "POST", action: to("/fc"), children });
      },
      POST: action(fc, "fc.page", { input: s.object({}) }, async () => ok(null)),
    },
  });
};

it.each(["node", "array", "text"] as const)("Form renders a thunk of %s children", async (kind) => {
  const ctx = createCtx({ mode: "sim" });
  const router = createRouter(formRoutes(kind), {
    ctx,
    history: memoryHistory("/fc"),
  });
  const host = document.createElement("div");
  const unmount = mount(router.App, host, { ctx });
  await settle();
  const form = host.querySelector("form");
  expect(form).not.toBeNull();
  if (kind === "text") expect(form?.textContent).toBe("hi");
  else expect(form?.querySelectorAll('[data-x="kid"]')).toHaveLength(1);
  unmount();
  router.dispose();
});

it("clicks on same-origin links inside the App navigate client-side", async () => {
  const lk = contract("lk", { "lk.a": { path: "/lk/a" }, "lk.b": { path: "/lk/b" } });
  const routes = manifest(lk, {
    "lk.a": { component: () => el("a", [Object.assign(document.createElement("a"), { href: "/lk/b" })]) },
    "lk.b": { component: () => el("b") },
  });
  const history = memoryHistory("/lk/a");
  const ctx = createCtx({ mode: "sim" });
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
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
