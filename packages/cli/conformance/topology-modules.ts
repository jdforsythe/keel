// Fixture modules `a` and `b` for the k.topology conformance files (not a test file). Seed for every property: 1337.
// `a`: GET /a/:n, whose loader calls `service({ module: 'b' })`; POST /a/:n, whose action bumps b through the same service.
// `b`: GET /b/:n answers the stored count; POST /b/:n bumps it; its runner writes `b.started`.
// RFC 0080 pieces (`service({ module })`, `peers`, `runners`, `deployable`) are passed loosely and only inside test bodies.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createCtx } from "@keel/ctx";
import type { Ctx, SimCtx } from "@keel/ctx";
import { action, loader, manifest, routesArtifact } from "@keel/router";
import type { Manifest, RouteDef } from "@keel/router";
import { err, ok, s } from "@keel/schema";
import { endpoints, service } from "@keel/services";
import * as server from "@keel/server";

export const SEED = 1337;
export type Fetcher = { fetch(req: Request): Promise<Response>; close?: () => Promise<void> };

const isFetcher = (v: unknown): v is Fetcher => typeof v === "object" && v !== null && "fetch" in v;

export async function createAppLoose(o: Record<string, unknown>): Promise<Fetcher> {
  const f: unknown = Reflect.get(server, "createApp");
  if (typeof f !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(f, undefined, [o]);
  if (!isFetcher(app)) throw new Error("createApp did not return an app with fetch");
  return app;
}

export const simCtx = (): SimCtx => createCtx({ mode: "sim", seed: SEED });
export async function flush(): Promise<void> {
  for (let i = 0; i < 50; i++) await Promise.resolve();
}

const Item = s.object({ n: s.string(), count: s.int() });
const Params = s.object({ n: s.string() });
const Nothing = s.object({});
const view = () => document.createElement("main");

/** `service({ module: 'b' })`: typed loosely until the option exists in `ServiceOptions`. */
export function bClient() {
  const schema = endpoints({
    get: {
      method: "GET",
      path: "/b/:n",
      params: Params,
      output: Item,
    },
    bump: {
      method: "POST",
      path: "/b/:n",
      params: Params,
      body: Nothing,
      output: s.string().nullable(),
    },
  });
  const made: unknown = Reflect.apply(service, undefined, [{ module: "b", schema }]);
  return { schema, call: (name: "get" | "bump", n: string, ctx: Ctx) => callClient(made, name, n, ctx) };
}

async function callClient(client: unknown, name: string, n: string, ctx: Ctx) {
  const fn: unknown = typeof client === "object" && client !== null ? Reflect.get(client, name) : undefined;
  if (typeof fn !== "function") throw new Error(`client has no ${name}`);
  const input = name === "bump" ? { params: { n }, body: {} } : { params: { n } };
  const r: unknown = await Reflect.apply(fn, client, [input, ctx]);
  return r;
}

const readCount = async (ctx: Ctx) => Number((await ctx.storage.get("b.count")) ?? "0");

export function moduleB() {
  const get = loader({ output: Item, params: Params }, async (a, ctx) =>
    ok({ n: a.params.n, count: await readCount(ctx) }),
  );
  const bump = action({ input: Nothing, params: Params }, async (_i, a, ctx) => {
    const c = (await readCount(ctx)) + 1;
    await ctx.storage.set("b.count", String(c));
    return ok(null);
  });
  const routes = manifest({ "b.item": { path: "/b/:n", params: Params, loader: get, component: view } });
  routes.actions({ "b.item": { POST: bump } });
  const runner = {
    run: async (ctx: Ctx) => {
      await ctx.storage.set("b.started", "1");
    },
  };
  return { routes, runner };
}

export function moduleA(call: ReturnType<typeof bClient>["call"]) {
  const get = loader({ output: Item, params: Params }, async (a, ctx) => {
    const r = await call("get", a.params.n, ctx);
    const item = isOkItem(r) ? r.value : undefined;
    return item ? ok(item) : err(s.error("a.upstream", Nothing).make({}));
  });
  const post = action({ input: Nothing, params: Params }, async (_i, a, ctx) => {
    await call("bump", a.params.n, ctx);
    await ctx.storage.set("a.last", a.params.n);
    return ok(null);
  });
  const routes = manifest({ "a.show": { path: "/a/:n", params: Params, loader: get, component: view } });
  routes.actions({ "a.show": { POST: post } });
  return { routes };
}

type ItemAnswer = { ok: true; value: { n: string; count: number } };
function isOkItem(r: unknown): r is ItemAnswer {
  return typeof r === "object" && r !== null && Reflect.get(r, "ok") === true;
}

/** `routes.json` for a manifest in a fresh directory (ASSUMPTION: `{ data, hash }`, `data` = router's `routesArtifact`). */
export function writeArtifacts(m: Manifest<Readonly<Record<string, RouteDef>>>): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-artifacts-"));
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data: routesArtifact(m), hash: "" }));
  return dir;
}

export const STATE_KEYS = ["a.last", "b.count", "b.started"] as const;
export async function stateOf(...ctxs: SimCtx[]): Promise<Record<string, string | null>> {
  const out: Record<string, string | null> = {};
  for (const k of STATE_KEYS) {
    out[k] = null;
    for (const c of ctxs) out[k] = out[k] ?? (await c.storage.get(k));
  }
  return out;
}

export type Op = { readonly kind: "getA" | "getB" | "postA" | "postB"; readonly n: string };
export function request(op: Op): Request {
  const json = { accept: "application/json", "x-keel": "1" };
  switch (op.kind) {
    case "getA":
      return new Request(`http://localhost/a/${op.n}`, { headers: json });
    case "getB":
      return new Request(`http://localhost/b/${op.n}`, { headers: json });
    case "postA":
      return new Request(`http://localhost/a/${op.n}`, {
        method: "POST",
        body: "{}",
        headers: { ...json, "content-type": "application/json" },
      });
    case "postB":
      return new Request(`http://localhost/b/${op.n}`, {
        method: "POST",
        body: "{}",
        headers: { ...json, "content-type": "application/json" },
      });
  }
}
