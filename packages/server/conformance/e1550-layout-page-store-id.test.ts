// @vitest-environment happy-dom
// Spec: k.server, Conformance "A layout whose loader names factory `a` and a page under it whose loader names `b`, where `b` spreads `a()` and both create store id `x.s`, is one E1550 in `keel check` at the page loader's `stores` value naming `a`, `b`, `x.s` and the layout's id, and `createApp` throws E1550; with both loaders naming `a`, neither, and a GET of the page answers 200 with `a` run once."
// Spec: k.server, Rules "`keel build` and `createApp` run each factory once on a sim ctx (k.compat Surface) and refuse it (`createApp` throws)"
// Seed 1337: no generated input.
// ASSUMPTION: the thrown error's message mentions `E1550`, as e1558-live-loader-non-node.test.ts reads E1558.
// Not built yet: the refusal case is `test.skip`; the builder changes it to `test`. The shared-factory case is live.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import { store } from "@keel/store";
import { expect, test } from "vitest";

const Out = s.object({});
const S = s.object({});

async function build(names: { layout: "a" | "b"; page: "a" | "b" }) {
  const runs = { a: 0 };
  const a = () => {
    runs.a++;
    return { s: store(S, {}, { id: "x.s" }) };
  };
  const b = () => ({ ...a(), t: store(S, {}, { id: "x.s" }) });
  const factories = { a, b };
  const c = contract("app", { "app.layout": { layout: true }, "app.page": { path: "/p" } });
  const layoutLoader = loader(c, "app.layout", { output: Out, stores: factories[names.layout] }, async () => ok({}));
  const pageLoader = loader(c, "app.page", { output: Out, stores: factories[names.page] }, async () => ok({}));
  const routes = manifest(c, {
    "app.layout": { component: (p) => p.children?.() ?? document.createElement("div"), loader: layoutLoader },
    "app.page": { component: () => document.createElement("main"), layout: "app.layout", loader: pageLoader },
  });
  const app = await createApp({
    topology: topology({ web: { modules: ["app"], adapter: "node" } }),
    routes,
    ctx: createCtx({ mode: "sim", seed: 1337 }),
    mode: "production",
  });
  return { app, runs };
}

test.skip("`createApp` throws E1550 when a layout's loader names `a` and its page's loader names `b`, both creating store id `x.s`", async () => {
  const message = await build({ layout: "a", page: "b" }).then(
    () => "built",
    (e: unknown) => (e instanceof Error ? e.message : JSON.stringify(e)),
  );
  expect(message).toContain("E1550");
});

test("with both loaders naming `a`, `createApp` builds and a GET of the page answers 200 with `a` run once", async () => {
  const { app, runs } = await build({ layout: "a", page: "a" });
  runs.a = 0;
  const res = await app.fetch(new Request("http://localhost/p"));
  expect(res.status).toBe(200);
  expect(runs.a).toBe(1);
});
