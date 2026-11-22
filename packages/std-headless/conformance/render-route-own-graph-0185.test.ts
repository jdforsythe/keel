// @vitest-environment happy-dom
// Spec: k.testing, Conformance "Two harnesses of one page with `app`, `routes` as an import, a client store and a widget each resume and keep their own client state."
// Spec: k.testing, Harness "With `routes: () => import(path)` the page resumes likewise (E1722 without `app`), so each harness owns its client stores, widgets and islands; server state on `ctx` is shared."
// Seed: 1337 (no generated input). `renderRoute` rejects E1720 on a resume warning, so a harness that returns resumed with none.
// ASSUMPTION: a submit is `fire('og.note', input)` then `fire('og.save', click)`; `h.navigate('/p')` reloads the page from `app`.
// See render-route-own-graph-routes.ts.
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { expect, test } from "vitest";
import { control, oc, routes } from "./render-route-own-graph-routes.ts";
import { SEED } from "./resume-support.ts";

const click = { type: "click" } as const;
const FRESH = () => import("./render-route-own-graph-routes.ts");

async function two() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  control.ctx = ctx;
  const app = await createApp({
    topology: topology({ web: { modules: ["og"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  const h1 = await renderRoute("og.page", { routes: FRESH, app, ctx });
  const h2 = await renderRoute("og.page", { routes: FRESH, app, ctx });
  return {
    ctx,
    h1,
    h2,
    done: () => {
      h1.dispose();
      h2.dispose();
    },
  };
}

test("two harnesses of one page with `app` and `routes` as an import each resume with no E1720", async () => {
  const { h1, h2, done } = await two();
  try {
    expect(h1.find("og.n").text).toBe("0");
    expect(h2.find("og.n").text).toBe("0");
    expect(h1.find("og.tabs.tab.one").state.selected).toBe(true);
    expect(h2.find("og.tabs.tab.one").state.selected).toBe(true);
  } finally {
    done();
  }
});

test("a change in one harness's client store is not seen by the other", async () => {
  const { h1, h2, done } = await two();
  try {
    await h1.fire("og.inc", click);
    expect(h1.find("og.n").text).toBe("1");
    expect(h2.find("og.n").text).toBe("0");
    await h2.fire("og.inc", click);
    await h2.fire("og.inc", click);
    expect(h2.find("og.n").text).toBe("2");
    expect(h1.find("og.n").text).toBe("1");
    expect(h1.state()["og.count"]).toEqual({ n: 1 });
    expect(h2.state()["og.count"]).toEqual({ n: 2 });
  } finally {
    done();
  }
});

test("a change in one harness's widget is not seen by the other", async () => {
  const { h1, h2, done } = await two();
  try {
    await h1.fire("og.tabs.tab.one", { type: "focus" });
    await h1.fire("og.tabs.tab.one", { type: "keydown", key: "ArrowRight" });
    expect(h1.find("og.tabs.tab.two").state.selected).toBe(true);
    expect(h1.find("og.body.two").text).toBe("Body two");
    expect(h2.find("og.tabs.tab.one").state.selected).toBe(true);
    expect(h2.find("og.tabs.tab.two").state.selected).toBe(false);
  } finally {
    done();
  }
});

test("a server write through one harness is read by the other", async () => {
  const { ctx, h1, h2, done } = await two();
  try {
    expect(h2.find("og.server").text).toBe("");
    await h1.fire("og.note", { type: "input", value: "hello" });
    await h1.fire("og.save", click);
    expect(await ctx.storage.get("og.note")).toBe("hello");
    await h2.navigate(oc.href("og.page"));
    expect(h2.find("og.server").text).toBe("hello");
  } finally {
    done();
  }
});
