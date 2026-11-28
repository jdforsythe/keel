// @vitest-environment happy-dom
// Spec: k.head, clause "After a client navigation to another route, the focused element is the new page's first `h1`, with `tabindex=\"-1\"`, or `main` when it has none; after a navigation that changes only the search, focus is where it was."
// Seed 1337.
// Assumed: the router API of head-fixtures.ts (createRouter, memoryHistory, mount); a layout renders `main` around the chain; `main` receives `tabindex="-1"` as in push-focus-scroll.test.ts.
import { createCtx } from "@keel/ctx";
import { createRouter, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { mount } from "@keel/runtime-dom";
import { s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { memoryHistory, settle } from "./fixtures.ts";

const simCtx = createCtx({ mode: "sim", seed: 1337 });

const SEED = 1337;
type Kids = { children?: () => Node | Node[] | string };
const el = (tag: string, id: string, text: string): HTMLElement => {
  const e = document.createElement(tag);
  e.id = id;
  e.textContent = text;
  return e;
};
const shell = (props: Kids): Node => {
  const main = document.createElement("main");
  main.id = "f.main";
  main.append(...[props.children?.() ?? ""].flat());
  return main;
};
const fContract = contract("f", {
  "f.shell": { layout: true },
  "f.a": { path: "/a" },
  "f.b": { path: "/b" },
  "f.plain": { path: "/plain" },
  "f.s": { path: "/s", search: s.object({ q: s.int({ min: 0, max: 99 }).optional() }) },
});

const routes = manifest(fContract, {
  "f.shell": { component: shell },
  "f.a": {
    layout: "f.shell",
    component: () => {
      const d = document.createElement("div");
      d.append(el("p", "f.a.intro", "intro"), el("h1", "f.a.h1", "First"), el("h1", "f.a.h1b", "Second"));
      return d;
    },
  },
  "f.b": { layout: "f.shell", component: () => el("h1", "f.b.h1", "Bee") },
  "f.plain": { layout: "f.shell", component: () => el("p", "f.plain.p", "no heading") },
  "f.s": {
    layout: "f.shell",
    component: () => {
      const d = document.createElement("div");
      const b = el("button", "f.s.btn", "Go");
      d.append(el("h1", "f.s.h1", "Search"), b);
      return d;
    },
  },
});
type Id = "f.a" | "f.b" | "f.plain" | "f.s";
const open = async (at: string) => {
  const router = createRouter(routes, { ctx: createCtx({ mode: "sim", seed: SEED }), history: memoryHistory(at) });
  const host = document.createElement("div");
  document.body.append(host);
  const unmount = mount(router.App, host, { ctx: simCtx });
  await settle();
  return {
    router,
    host,
    stop: () => {
      unmount();
      router.dispose();
      host.remove();
    },
  };
};
const href = (id: Id) => fContract.href(id, {}, {});

describe("k.head: focus after navigation", () => {
  test('After a client navigation to another route, the focused element is the new page\'s first `h1`, with `tabindex="-1"`', async () => {
    const app = await open("/b");
    await app.router.navigate(href("f.a"));
    await settle();
    const h1 = app.host.querySelector("h1");
    expect(h1?.id).toBe("f.a.h1");
    expect(document.activeElement).toBe(h1);
    expect(h1?.getAttribute("tabindex")).toBe("-1");
    app.stop();
  });

  test("or `main` when it has none", async () => {
    const app = await open("/b");
    await app.router.navigate(href("f.plain"));
    await settle();
    const main = app.host.querySelector("main");
    expect(main).not.toBeNull();
    expect(document.activeElement).toBe(main);
    app.stop();
  });

  test("for any pair of distinct routes the focus lands on the target's first h1, or main when it has none (property)", async () => {
    const ids: Id[] = ["f.a", "f.b", "f.plain", "f.s"];
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...ids), fc.constantFrom(...ids), async (from, to) => {
        fc.pre(from !== to);
        const app = await open(String(href(from)));
        await app.router.navigate(href(to));
        await settle();
        const want = app.host.querySelector("h1") ?? app.host.querySelector("main");
        expect(want).not.toBeNull();
        expect(document.activeElement).toBe(want);
        if (want?.localName === "h1") expect(want.getAttribute("tabindex")).toBe("-1");
        app.stop();
      }),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("after a navigation that changes only the search, focus is where it was", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 99 }), async (q) => {
        const app = await open("/s");
        const btn = app.host.querySelector("#f\\.s\\.btn");
        expect(btn).not.toBeNull();
        if (!(btn instanceof HTMLElement)) throw new Error("fixture: no button");
        btn.focus();
        expect(document.activeElement).toBe(btn);
        await app.router.navigate(fContract.href("f.s", {}, { q }));
        await settle();
        expect(document.activeElement?.id).toBe("f.s.btn");
        app.stop();
      }),
      { seed: SEED, numRuns: 15 },
    );
  });
});
