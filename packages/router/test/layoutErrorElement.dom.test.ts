// @vitest-environment happy-dom
// A layout's errorElement (k.router): the nearest errorElement in the chain renders a child page's loader `err` or
// throw, and the layouts above it stay.
import { createCtx } from "@keel/ctx";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { err, s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { loader } from "../src/loader.ts";
import { manifest } from "../src/manifest.ts";
import type { RouteProps } from "../src/types/RouteProps.ts";
import type { RouteTable } from "../src/types/RouteTable.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const el = (name: string, kids: Node[] = []): HTMLElement => {
  const e = document.createElement("div");
  e.setAttribute("data-x", name);
  e.append(...kids);
  return e;
};
const shell =
  (name: string) =>
  (p: RouteProps): Node =>
    el(name, p.children === undefined ? [] : [p.children()]);
const Boom = s.error("le.boom", s.object({}));

function boot(routes: RouteTable, start: string) {
  const ctx = createCtx({ mode: "sim", seed: 7 });
  const router = createRouter(routes, { ctx, history: memoryHistory(start) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx });
  return {
    host,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
}

const lc = contract("lc", {
  "lc.root": { layout: true },
  "lc.inner": { layout: true },
  "lc.err": { path: "/err" },
  "lc.throw": { path: "/throw" },
});
const routes = manifest(lc, {
  "lc.root": { component: shell("root") },
  "lc.inner": {
    component: shell("inner"),
    layout: "lc.root",
    errorElement: ({ error }) => el(`inner-err:${error.code}`),
  },
  "lc.err": {
    layout: "lc.inner",
    loader: loader(lc, "lc.err", { output: s.object({}) }, async () => err(Boom.make({}))),
    component: () => el("page"),
  },
  "lc.throw": {
    layout: "lc.inner",
    component: () => {
      throw new Error("render boom");
    },
  },
});

describe("a layout's errorElement", () => {
  it("renders a child page's loader err, the layouts above it staying", async () => {
    const t = boot(routes, "/err");
    await settle();
    expect(t.host.querySelector('[data-x="root"] > [data-x="inner-err:le.boom"]')).not.toBeNull();
    expect(t.host.querySelector('[data-x="inner"]')).toBeNull();
    expect(t.host.querySelector('[data-x="page"]')).toBeNull();
    t.stop();
  });

  it("catches a child page's throw, the layouts above it staying", async () => {
    const t = boot(routes, "/throw");
    await settle();
    expect(t.host.querySelector('[data-x="root"] [data-x="inner-err:keel.unexpected"]')).not.toBeNull();
    expect(t.host.querySelector('[data-x="inner"]')).toBeNull();
    t.stop();
  });
});
