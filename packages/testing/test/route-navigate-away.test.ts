// @vitest-environment happy-dom
// Spec: k.testing Harness (`renderRoute` `navigate`), k.router: a harness that navigated shows only the page it
// navigated to, with or without an `errorElement`; once disposed, a second harness in the document is alone.
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import { renderRoute } from "@keel/testing";
import { describe, expect, it } from "vitest";

const main = (id: string): HTMLElement => {
  const m = document.createElement("main");
  m.id = id;
  const h = document.createElement("h1");
  h.textContent = id;
  m.append(h);
  return m;
};
const error = (): Node => main("nav.error");

const plain = manifest({
  "nav.a": { path: "/a", component: () => main("nav.a") },
  "nav.b": { path: "/b", component: () => main("nav.b") },
});
const guarded = manifest({
  "nav.a": { path: "/a", component: () => main("nav.a"), errorElement: error },
  "nav.b": { path: "/b", component: () => main("nav.b"), errorElement: error },
  "nav.throws": {
    path: "/throws",
    component: () => {
      throw new Error("boom");
    },
    errorElement: error,
  },
});

const mains = (): string[] => [...document.querySelectorAll("main")].map((m) => m.id);
const sim = () => createCtx({ mode: "sim" });

describe("renderRoute navigate: the page navigated away from leaves the document", () => {
  it.each([
    ["without an errorElement", plain],
    ["with an errorElement", guarded],
  ])("%s", async (_, routes) => {
    const h = await renderRoute("nav.a", { routes, ctx: sim() });
    expect(mains()).toEqual(["nav.a"]);
    await h.navigate(routes.href("nav.b"));
    expect(mains()).toEqual(["nav.b"]);
    await h.navigate(routes.href("nav.a"));
    expect(mains()).toEqual(["nav.a"]);
    h.dispose();
    expect(mains()).toEqual([]);
    const second = await renderRoute("nav.b", { routes, ctx: sim() });
    expect(mains()).toEqual(["nav.b"]);
    second.dispose();
  });

  it("from a page whose errorElement caught a throw", async () => {
    const h = await renderRoute("nav.throws", { routes: guarded, ctx: sim() });
    expect(mains()).toEqual(["nav.error"]);
    await h.navigate(guarded.href("nav.a"));
    expect(mains()).toEqual(["nav.a"]);
    h.dispose();
    expect(mains()).toEqual([]);
  });
});
