// @vitest-environment happy-dom
// Examples: navigating away from a route leaves none of its nodes in the document (k.router, k.errors),
// whether the route has an errorElement (a Boundary), sits under a layout, or its Boundary caught a throw.
import { createCtx } from "@keel/ctx";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { createRouter } from "../src/createRouter.ts";
import { manifest } from "../src/manifest.ts";
import type { Href } from "../src/types/Href.ts";
import { memoryHistory } from "./memoryHistory.ts";

const settle = async (): Promise<void> => {
  for (let i = 0; i < 64; i++) await Promise.resolve();
};
const main = (name: string, kids: Node[] = []): HTMLElement => {
  const e = document.createElement("main");
  e.setAttribute("data-x", name);
  e.append(...kids);
  return e;
};
const error = (): Node => main("error");

const routes = manifest({
  "na.a": { path: "/na/a", component: () => main("a"), errorElement: error },
  "na.b": { path: "/na/b", component: () => main("b") },
  "na.throws": {
    path: "/na/throws",
    component: () => {
      throw new Error("boom");
    },
    errorElement: error,
  },
  "na.shell": {
    component: (p) => {
      const d = document.createElement("div");
      d.setAttribute("data-x", "shell");
      if (p.children !== undefined) d.append(p.children());
      return d;
    },
  },
  "na.inner": {
    path: "/na/inner/:n",
    params: s.object({ n: s.int() }),
    layout: "na.shell",
    component: (p) => main(`inner${JSON.stringify(p.params)}`),
    errorElement: error,
  },
  "na.flat": {
    path: "/na/flat",
    component: () => {
      const f = document.createDocumentFragment();
      f.append(main("flat"), document.createElement("footer"));
      return f;
    },
    errorElement: error,
  },
});

const mains = (host: Element): string[] =>
  [...host.querySelectorAll("main")].map((m) => m.getAttribute("data-x") ?? "");

async function open(start: string): Promise<{ host: HTMLElement; go: (url: Href) => Promise<void>; done: () => void }> {
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim" }), history: memoryHistory(start) });
  const host = document.createElement("div");
  const unmount = mount(router.App, host);
  await settle();
  return {
    host,
    go: async (url) => {
      void router.navigate(url);
      await settle();
    },
    done: () => {
      unmount();
      router.dispose();
    },
  };
}

describe("navigating away removes the old page", () => {
  it("from a top-level route with an errorElement", async () => {
    const r = await open("/na/a");
    expect(mains(r.host)).toEqual(["a"]);
    await r.go(routes.href("na.b"));
    expect(mains(r.host)).toEqual(["b"]);
    await r.go(routes.href("na.a"));
    expect(mains(r.host)).toEqual(["a"]);
    r.done();
  });

  it("from a route whose errorElement caught a throw", async () => {
    const r = await open("/na/throws");
    expect(mains(r.host)).toEqual(["error"]);
    await r.go(routes.href("na.b"));
    expect(mains(r.host)).toEqual(["b"]);
    r.done();
  });

  it("from a route with an errorElement under a layout, to a sibling and out of the layout", async () => {
    const r = await open("/na/inner/1");
    expect(mains(r.host)).toEqual(['inner{"n":1}']);
    await r.go(routes.href("na.inner", { n: 2 }));
    expect(mains(r.host)).toEqual(['inner{"n":2}']);
    expect(r.host.querySelectorAll('[data-x="shell"]')).toHaveLength(1);
    await r.go(routes.href("na.b"));
    expect(mains(r.host)).toEqual(["b"]);
    expect(r.host.querySelector('[data-x="shell"]')).toBeNull();
    r.done();
  });

  it("from a route with an errorElement whose component renders several top-level nodes", async () => {
    const r = await open("/na/flat");
    expect(mains(r.host)).toEqual(["flat"]);
    await r.go(routes.href("na.b"));
    expect(mains(r.host)).toEqual(["b"]);
    expect(r.host.querySelector("footer")).toBeNull();
    r.done();
  });
});
