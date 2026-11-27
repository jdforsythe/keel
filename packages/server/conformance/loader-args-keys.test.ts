// @vitest-environment happy-dom
// Spec: k.contract, clause "A loader's `fn` argument has exactly the keys `params`, `search`, `url`, `caller`, `user`, `bearer`, `stores` and `signal`."
// k.server API: "`loader(contract, id, { output?, stores? }, fn)`: `fn` gets `{ params, search, url, caller, user, bearer, stores, signal }` and `ctx`; a route that must judge where a request came from declares `local` (k.contract Local routes); `url` carries `KEEL_ORIGIN`'s origin where set; returns `Promise<Result<T, KeelError>>` encoded with `output` (the entry's on an API entry, k.contract)."
// Seed: n/a (the keys are a fixed list). Method: `createApp` over a manifest of a page loader, an API GET loader and an API GET loader with `query`, each recording `Object.keys` of its first argument; each is requested over `app.fetch` with `sec-fetch-site: same-origin` and `host` set, as a request a loader could read them from.
// ASSUMED: (1) the key list is the same for a page loader and an API GET loader (the clause says "A loader's"); (2) `signal` is present on a request-time loader that is not live.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import * as server from "@keel/server";
import { describe, expect, it } from "vitest";
import { withHeaders } from "./topology-fixtures.ts";

const SEED = 1337; // seed 1337 (no random input)
const KEYS = ["bearer", "caller", "params", "search", "signal", "stores", "url", "user"];
const Out = s.object({ n: s.int() });
const c = contract("a", {
  "a.home": { path: "/" },
  "a.item": { path: "/item/:id", params: s.object({ id: s.string() }), search: s.object({ q: s.string().optional() }) },
  "a.box": { method: "GET", path: "/api/box", output: Out },
  "a.find": { method: "GET", path: "/api/find", query: s.object({ q: s.string().optional() }), output: Out },
});
const seen: Record<string, string[]> = {};
const record = (id: string) => async (args: object) => {
  seen[id] = Object.keys(args).sort();
  return ok({ n: 1 });
};
const page = (): Node => document.createElement("main");
const routes = manifest(c, {
  "a.home": { component: page, loader: loader(c, "a.home", { output: Out }, record("a.home")) },
  "a.item": { component: page, loader: loader(c, "a.item", { output: Out }, record("a.item")) },
  "a.box": { loader: loader(c, "a.box", {}, record("a.box")) },
  "a.find": { loader: loader(c, "a.find", {}, record("a.find")) },
});

type Fetcher = { fetch(req: Request): Promise<Response> };
const isFetcher = (v: unknown): v is Fetcher => typeof v === "object" && v !== null && "fetch" in v;
const boot = async (): Promise<Fetcher> => {
  const make: unknown = Reflect.get(server, "createApp");
  if (typeof make !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(make, undefined, [
    {
      topology: topology({ web: { modules: ["a"], adapter: "node" } }),
      routes,
      ctx: createCtx({ mode: "sim", seed: SEED }),
      mode: "production",
    },
  ]);
  if (!isFetcher(app)) throw new Error("createApp did not return an app with fetch");
  return app;
};
const get = (path: string): Request =>
  withHeaders(new Request(`http://localhost:3000${path}`), {
    accept: "application/json",
    host: "localhost:3000",
    "sec-fetch-site": "same-origin",
  });

describe("k.contract loader arguments", () => {
  it("A loader's `fn` argument has exactly the keys `params`, `search`, `url`, `caller`, `user`, `bearer`, `stores` and `signal`", async () => {
    const app = await boot();
    for (const [id, path] of [
      ["a.home", "/"],
      ["a.item", "/item/7?q=x"],
      ["a.box", "/api/box"],
      ["a.find", "/api/find?q=x"],
    ] as const) {
      const r = await app.fetch(get(path));
      expect(r.status, id).toBe(200);
      expect(seen[id], id).toEqual(KEYS);
    }
  });

  it("a loader's argument has no `site` and no `host`, whatever `Sec-Fetch-Site` and `Host` the request carried", async () => {
    const app = await boot();
    for (const site of ["same-origin", "cross-site", "none"]) {
      const req = withHeaders(new Request("http://example.test:3000/api/box"), {
        accept: "application/json",
        host: "example.test:3000",
        "sec-fetch-site": site,
      });
      await app.fetch(req);
      expect(seen["a.box"]).toEqual(KEYS);
      expect(seen["a.box"]?.includes("site")).toBe(false);
      expect(seen["a.box"]?.includes("host")).toBe(false);
    }
  });
});
