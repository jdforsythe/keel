// @vitest-environment happy-dom
// `navigate` (k.router Client) from a component callback: push, and `replace`; with no router mounted it does nothing.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import { navigate } from "../src/navigate.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const nv = contract("nv", {
  "nv.list": { path: "/nv", search: s.object({ q: s.string().optional() }) },
  "nv.other": { path: "/other" },
});
const routes = manifest(nv, {
  "nv.list": {
    component: () => {
      const b = document.createElement("button");
      b.id = "go";
      b.textContent = "Go";
      // A plain DOM listener: runs outside any scope, as an app callback does.
      b.addEventListener("click", () => {
        void navigate(nv.href("nv.list", {}, { q: "r" }), { replace: true });
      });
      return b;
    },
  },
  "nv.other": { component: () => document.createElement("p") },
});

it("a callback navigates the mounted router: replace rewrites the entry, push adds one", async () => {
  const history = memoryHistory("/nv");
  const ctx = createCtx({ mode: "sim" });
  const router = createRouter(routes, { ctx, history });
  const host = document.createElement("div");
  document.body.appendChild(host);
  const unmount = mount(router.App, host, { ctx });
  await settle();
  host.querySelector("#go")?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  await settle();
  expect(router.route.get()).toMatchObject({ id: "nv.list", search: { q: "r" } });
  expect(history.entries).toEqual(["/nv?q=r"]);
  await navigate(nv.href("nv.other"));
  await settle();
  expect(router.route.get()).toMatchObject({ id: "nv.other" });
  expect(history.entries).toEqual(["/nv?q=r", "/other"]);
  unmount();
  router.dispose();
  host.remove();
});

it("with no router mounted it does nothing and resolves", async () => {
  await expect(navigate(nv.href("nv.other"))).resolves.toBeUndefined();
});

it("with two routers mounted a callback's navigate reaches neither", async () => {
  const make = () => {
    const history = memoryHistory("/nv");
    const ctx = createCtx({ mode: "sim" });
    const router = createRouter(routes, { ctx, history });
    const host = document.createElement("div");
    document.body.appendChild(host);
    return { history, router, host, off: mount(router.App, host, { ctx }) };
  };
  const a = make();
  const b = make();
  await settle();
  await navigate(nv.href("nv.other"));
  await settle();
  expect(a.history.entries).toEqual(["/nv"]);
  expect(b.history.entries).toEqual(["/nv"]);
  for (const x of [a, b]) {
    x.off();
    x.router.dispose();
    x.host.remove();
  }
});
