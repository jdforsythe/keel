// Shared helpers for the k.contract server conformance files (RFC 0157). Not a test file. Property seed: 1337.
// ASSUMPTIONS: `createApp({ topology, routes, ctx, mode? })` returns `{ fetch(req) }` with `routes` the value of `manifest(contract, binding)`
// (the generated entry's merge is not under test); a runtime (JSON) request is a request with `accept: application/json`.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { topology } from "@keel/server";
import * as server from "@keel/server";

export const SEED = 1337; // seed 1337
export const BASE = "http://localhost";

export type Fetcher = { fetch(req: Request): Promise<Response> };
const isFetcher = (v: unknown): v is Fetcher =>
  typeof v === "object" && v !== null && "fetch" in v && typeof v.fetch === "function";

/** `createApp` with the options typed loosely so a fixture can pass the value of `manifest(contract, binding)`. */
export const boot = async (
  routes: unknown,
  modules: readonly string[],
  adapter: "node" | "client" = "node",
  ctx: Ctx = createCtx({ mode: "sim", seed: SEED }),
): Promise<Fetcher> => {
  const make: unknown = Reflect.get(server, "createApp");
  if (typeof make !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(make, undefined, [
    {
      topology: topology({ web: { modules: [...modules], adapter } }),
      routes,
      ctx,
      mode: "production",
    },
  ]);
  if (!isFetcher(app)) throw new Error("createApp did not return an app with fetch");
  return app;
};

export const get = (path: string, headers: Record<string, string> = {}): Request =>
  new Request(`${BASE}${path}`, { headers: { accept: "application/json", ...headers } });
export const getHtml = (path: string): Request => new Request(`${BASE}${path}`, { headers: { accept: "text/html" } });

export const form = (path: string, fields: Record<string, string>, headers: Record<string, string> = {}): Request => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return new Request(`${BASE}${path}`, { method: "POST", body: fd, headers: { origin: BASE, ...headers } });
};
export const postJson = (path: string, body: unknown, headers: Record<string, string> = {}): Request =>
  new Request(`${BASE}${path}`, {
    method: "POST",
    body: JSON.stringify(body),
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      origin: BASE,
      "x-keel": "1",
      ...headers,
    },
  });

export const bodyOf = async (res: Response): Promise<string> => res.text();
