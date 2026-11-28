// @vitest-environment happy-dom
// k.topology Calls and peers: module `a`'s API entries call module `b`'s through `service({ contract })`, in one
// deployable and split across two. Seed 1337; sim ctxs only.
import fs from "node:fs";
import path from "node:path";
import { type Ctx, type SimCtx, createCtx } from "@keel/ctx";
import { action, loader, manifest, routeTable, routesArtifact } from "@keel/router";
import { contract } from "@keel/router/contract";
import { err, ok, s } from "@keel/schema";
import { createApp, topology } from "@keel/server";
import type { ServerApp } from "@keel/server";
import { service } from "@keel/services";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const Item = s.object({ n: s.string(), count: s.int() });
const Params = s.object({ n: s.string() });
const Nothing = s.object({});
const Answer = s.string().nullable();
const bContract = contract("b", {
  "b.get": { method: "GET", path: "/b/:n", params: Params, output: Item },
  "b.bump": { method: "POST", path: "/b/:n", params: Params, body: Nothing, output: Answer },
});
const aContract = contract("a", {
  "a.show": { method: "GET", path: "/a/:n", params: Params, output: Item },
  "a.post": { method: "POST", path: "/a/:n", params: Params, body: Nothing, output: Answer },
});
const b = service({ contract: bContract });
const count = async (ctx: Ctx) => Number((await ctx.storage.get("b.count")) ?? "0");

function modules() {
  const bGet = loader(bContract, "b.get", {}, async (a, ctx) => ok({ n: a.params.n, count: await count(ctx) }));
  const bump = action(bContract, "b.bump", {}, async (_body, _a, ctx) => {
    await ctx.storage.set("b.count", String((await count(ctx)) + 1));
    return ok(null);
  });
  const bRoutes = manifest(bContract, { "b.get": { loader: bGet }, "b.bump": { action: bump } });
  const aGet = loader(aContract, "a.show", {}, async (a, ctx) => {
    const r = await b.get({ params: { n: a.params.n } }, ctx);
    return r.ok ? ok(r.value) : err(s.error("a.upstream", Nothing).make({}));
  });
  const aPost = action(aContract, "a.post", {}, async (_body, a, ctx) => {
    const r = await b.bump({ params: { n: a.params.n }, body: {} }, ctx);
    await ctx.storage.set("a.last", a.params.n);
    return r.ok ? ok(null) : err(s.error("a.upstream", Nothing).make({}));
  });
  const aRoutes = manifest(aContract, { "a.show": { loader: aGet }, "a.post": { action: aPost } });
  const runner = { run: async (ctx: Ctx) => ctx.storage.set("b.started", "1") };
  return { aRoutes, bRoutes, runner };
}

type Op = { readonly kind: "a" | "b"; readonly post: boolean; readonly n: string };
const request = (o: Op) =>
  new Request(`http://localhost/${o.kind}/${o.n}`, {
    method: o.post ? "POST" : "GET",
    headers: { accept: "application/json", "x-keel": "1", ...(o.post ? { "content-type": "application/json" } : {}) },
    ...(o.post ? { body: "{}" } : {}),
  });
const sim = (): SimCtx => createCtx({ mode: "sim", seed: SEED });
const flush = async () => {
  for (let i = 0; i < 50; i++) await Promise.resolve();
};
const state = async (...ctxs: SimCtx[]) => {
  const out: Record<string, string | null> = {};
  for (const k of ["a.last", "b.count", "b.started"]) {
    out[k] = null;
    for (const c of ctxs) out[k] = out[k] ?? (await c.storage.get(k));
  }
  return out;
};
const split = () => topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });

describe("k.topology: module calls", () => {
  test("in one deployable a call makes no ctx.net.fetch; with y at a URL it makes one, to that URL", async () => {
    const m = modules();
    const oneCtx = sim();
    const fetched: string[] = [];
    oneCtx.net.route("*", (req) => {
      fetched.push(req.url);
      return new Response("", { status: 500 });
    });
    const one = await createApp({
      topology: topology({ one: { modules: ["a", "b"], adapter: "node" } }),
      routes: routeTable(m.aRoutes, m.bRoutes),
      ctx: oneCtx,
    });
    const here = await one.fetch(request({ kind: "a", post: false, n: "7" }));
    expect(here.status).toBe(200);
    expect(fetched).toEqual([]);

    const y = await createApp({ topology: split(), deployable: "y", routes: m.bRoutes, ctx: sim() });
    const xCtx = sim();
    const urls: string[] = [];
    xCtx.net.route("http://y.test/*", (req) => {
      urls.push(req.url);
      return y.fetch(req);
    });
    const x = await createApp({
      topology: split(),
      deployable: "x",
      routes: m.aRoutes,
      ctx: xCtx,
      peers: { y: "http://y.test" },
    });
    const there = await x.fetch(request({ kind: "a", post: false, n: "7" }));
    expect(there.status).toBe(200);
    expect(urls).toEqual(["http://y.test/b/7"]);
    await Promise.all([one.close(), x.close(), y.close()]);
  });

  test("a generated request script through one deployable and through a split gets equal answers and state", async () => {
    const op = fc.record({
      kind: fc.constantFrom<"a" | "b">("a", "b"),
      post: fc.boolean(),
      n: fc.stringMatching(/^[0-9]{1,3}$/),
    });
    await fc.assert(
      fc.asyncProperty(fc.array(op, { maxLength: 8 }), async (script) => {
        const m = modules();
        const runners = { b: [m.runner] };
        const oneCtx = sim();
        const one = await createApp({
          topology: topology({ one: { modules: ["a", "b"], adapter: "node" } }),
          routes: routeTable(m.aRoutes, m.bRoutes),
          ctx: oneCtx,
          runners,
        });
        const [xCtx, yCtx] = [sim(), sim()];
        const y: ServerApp = await createApp({
          topology: split(),
          deployable: "y",
          routes: m.bRoutes,
          ctx: yCtx,
          runners,
        });
        const dir = tempDir("keel-split-");
        fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data: routesArtifact(m.bRoutes), hash: "" }));
        const x = await createApp({
          topology: split(),
          deployable: "x",
          routes: m.aRoutes,
          ctx: xCtx,
          peers: { y },
          artifacts: dir,
        });
        await flush();
        for (const o of script) {
          const viaOne = await one.fetch(request(o));
          const viaX = await x.fetch(request(o));
          expect(viaX.status).toBe(viaOne.status);
          expect(viaOne.status).toBeLessThan(400);
          expect(await viaX.text()).toBe(await viaOne.text());
        }
        expect(await state(xCtx, yCtx)).toEqual(await state(oneCtx));
        await Promise.all([one.close(), x.close(), y.close()]);
      }),
      { seed: SEED, numRuns: 25 },
    );
  });
});
