// @vitest-environment happy-dom
// k.user Testing, k.testing Harness, k.mount Testing: two `renderRoute` harnesses of one page over one `app` and one
// `ctx` are two browsers. Each resumes, and its client stores and widget state are its own.
// `test/fixtures/TwoBrowsers.tsx` is compiled as app code to a module beside it, which each harness imports.
import fs from "node:fs";
import path from "node:path";
import { compile } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import type { RouteTable } from "@keel/router";
import { createApp, topology } from "@keel/server";
import { renderRoute } from "@keel/testing";
import { afterAll, beforeAll, expect, test } from "vitest";
import { isRecord } from "./support.ts";

const dir = path.join(import.meta.dirname, "fixtures");
const out = path.join(dir, "TwoBrowsers.compiled.ts");
// The test's own graph: its route table and module store, imported once (as an app test imports them statically).
const own: { routes?: RouteTable; view?: unknown } = {};
beforeAll(async () => {
  const r = compile([
    { path: "src/TwoBrowsers.tsx", source: fs.readFileSync(path.join(dir, "TwoBrowsers.tsx"), "utf8") },
  ]);
  expect(r.diagnostics).toEqual([]);
  fs.writeFileSync(out, r.outputs.find((o) => o.path === "src/TwoBrowsers.tsx")?.code ?? "");
  const mod: unknown = await import(out);
  own.routes = (await load()).routes;
  own.view = isRecord(mod) ? mod.view : undefined;
});
afterAll(() => fs.rmSync(out, { force: true }));

const isTable = (x: unknown): x is RouteTable => typeof x === "object" && x !== null;
const load = async (): Promise<{ readonly routes: RouteTable }> => {
  const mod: unknown = await import(out);
  const routes = isRecord(mod) ? mod.routes : undefined;
  if (!isTable(routes)) throw new Error("no compiled routes");
  return { routes };
};

const boot = async () => {
  const routes = own.routes;
  if (routes === undefined) throw new Error("no compiled routes");
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const app = await createApp({
    topology: topology({ web: { modules: ["tb2"], adapter: "node" } }),
    routes,
    ctx,
    mode: "production",
  });
  return { routes, ctx, app };
};

test("two harnesses of one page with a client store and a widget each resume and keep their own client state", async () => {
  const { ctx, app } = await boot();
  const one = await renderRoute("tb2.page", { routes: load, ctx, app });
  const two = await renderRoute("tb2.page", { routes: load, ctx, app });
  await one.fire("tb2.tabs.tab.b", { type: "click" });
  expect(one.find("tb2.shown").text).toBe("b");
  expect(one.state()["tb2.view"]).toEqual({ tab: "b" });
  expect(two.find("tb2.shown").text).toBe("a");
  expect(two.find("tb2.tabs.tab.a").state.selected).toBe(true);
  expect(two.state()["tb2.view"]).toEqual({ tab: "a" });
  await two.fire("tb2.tabs.tab.b", { type: "click" });
  await two.fire("tb2.tabs.tab.a", { type: "click" });
  expect(one.find("tb2.shown").text).toBe("b");
  expect(two.find("tb2.shown").text).toBe("a");
  one.dispose();
  two.dispose();
  await app.close();
});

test("the test's own client stores are not a harness's when routes is an import", async () => {
  const { routes, ctx, app } = await boot();
  const view = own.view;
  const one = await renderRoute("tb2.page", { routes: load, ctx, app });
  await one.fire("tb2.tabs.tab.b", { type: "click" });
  expect(one.state()["tb2.view"]).toEqual({ tab: "b" });
  expect(isRecord(view) && typeof view.get === "function" ? Reflect.apply(view.get, view, ["tab"]) : null).toBe("a");
  expect(one.route()).toMatchObject({ id: "tb2.page", pending: false });
  one.dispose();
  expect(routes).toBeDefined();
  await app.close();
});

test("with a route table the page resumes in the test's graph, as one browser", async () => {
  const { routes, ctx, app } = await boot();
  const one = await renderRoute("tb2.page", { routes, ctx, app });
  await one.fire("tb2.tabs.tab.b", { type: "click" });
  expect(one.find("tb2.shown").text).toBe("b");
  one.dispose();
  await app.close();
});
