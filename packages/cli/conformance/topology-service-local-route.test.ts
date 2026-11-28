// @vitest-environment happy-dom
// Spec: k.topology, clause "A loader of `x` calling `service({ contract: b })`'s method for `y`'s `local: true` API entry `b.state` gets an `err`, `y` in process and at a URL; `y` gets the request with `x-keel-forwarded: 1` and answers 403 `keel.denied`, its loader not run."
// Seed 1337 (no generated input: the two peer modes are the whole space). Lives in cli's conformance because the server package may not import `@keel/services` (tooling/deps.json order).
// Fixture: `x` serves module `a`, whose loader calls `service({ contract: b })`'s method `state`; `y` serves module `b` holding the `local: true` API entry `b.state` (`GET /api/state`), whose loader counts its runs.
// "y in process" is `peers: { y: <the app> }` wrapped to record the request it gets; "at a URL" is `peers: { y: 'http://y.test' }` routed on the sim net to `y` (as local-routes-peer-support.ts in packages/server does).
// ASSUMED: (1) the client method of entry `b.state` is `state`, called with `{}` and a ctx and answering `{ ok, ... }` as the neighbouring topology-modules.ts caller reads it; (2) the call reaches `y` with a loopback `Host`
// (`127.0.0.1:<port>`) and `Sec-Fetch-Site: none`, so only `x-keel-forwarded` can refuse it; (3) the 403 body holds the text `keel.denied`.
import { createCtx } from "@keel/ctx";
import type { Ctx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { topology } from "@keel/server";
import { service } from "@keel/services";
import { describe, expect, it } from "vitest";
import { SEED, createAppLoose, writeArtifacts } from "./topology-modules.ts";
import type { Fetcher } from "./topology-modules.ts";

const PORT = 4317;
const Tick = s.object({ n: s.int() });
const Nothing = s.object({});
const view = (): Node => document.createElement("main");
const SIX: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};

type Conn = { incoming: { socket: { remoteAddress: string } } };
const conn: Conn = { incoming: { socket: { remoteAddress: "127.0.0.1" } } };
type Seen = { path: string; forwarded: string | null; status: number; denied: boolean; sixOk: boolean };
const setHeaders = (req: Request, extra: Record<string, string>): Request => {
  const h = new Headers(req.headers);
  for (const [k, v] of Object.entries(extra)) h.set(k, v);
  Object.defineProperty(req, "headers", { value: h });
  return req;
};
/** `y.fetch` that records what it was asked and answered, from a loopback connection and a loopback `Host`. */
const spy = (y: Fetcher, seen: Seen[]): Fetcher => ({
  fetch: async (req: Request) => {
    const forwarded = req.headers.get("x-keel-forwarded");
    const res: Response = await Reflect.apply(y.fetch, y, [
      setHeaders(req, { host: `127.0.0.1:${PORT}`, "sec-fetch-site": "none" }),
      conn,
    ]);
    const body = await res.clone().text();
    seen.push({
      path: new URL(req.url).pathname,
      forwarded,
      status: res.status,
      denied: body.includes("keel.denied"),
      sixOk: Object.entries(SIX).every(([k, v]) => res.headers.get(k) === v),
    });
    return res;
  },
});

async function run(mode: "process" | "url"): Promise<{ result: unknown; seen: Seen[]; runs: () => number }> {
  let runs = 0;
  const b = contract("b", { "b.state": { method: "GET", path: "/api/state", output: Tick, local: true } });
  const state = loader(b, "b.state", {}, () => {
    runs += 1;
    return Promise.resolve(ok({ n: 1 }));
  });
  const bRoutes = manifest(b, { "b.state": { loader: state } });
  const a = contract("a", { "a.home": { path: "/a" } });
  const client = service({ contract: b });
  let result: unknown = "unset";
  const home = loader(a, "a.home", { output: Nothing }, async (_args, ctx: Ctx) => {
    const fn: unknown = Reflect.get(client, "state");
    if (typeof fn !== "function") throw new Error("client has no state");
    result = await Reflect.apply(fn, client, [{}, ctx]);
    return ok({});
  });
  const aRoutes = manifest(a, { "a.home": { component: view, loader: home } });
  const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
  const y = await createAppLoose({
    topology: t,
    deployable: "y",
    routes: bRoutes,
    ctx: createCtx({ mode: "sim", seed: SEED }),
  });
  const seen: Seen[] = [];
  const xCtx = createCtx({ mode: "sim", seed: SEED });
  let peer: unknown = "http://y.test";
  if (mode === "process") peer = spy(y, seen);
  else xCtx.net.route("http://y.test/*", (req) => spy(y, seen).fetch(req));
  const x = await createAppLoose({
    topology: t,
    deployable: "x",
    routes: aRoutes,
    ctx: xCtx,
    peers: { y: peer },
    artifacts: writeArtifacts(bRoutes),
  });
  await Reflect.apply(x.fetch, x, [
    new Request("http://localhost/a", { headers: { accept: "application/json", "x-keel": "1" } }),
    conn,
  ]);
  return { result, seen, runs: () => runs };
}

const isErr = (r: unknown): boolean => typeof r === "object" && r !== null && Reflect.get(r, "ok") === false;

describe("k.topology Calls and peers: a `service` call to a `local` route of a peer", () => {
  for (const mode of ["process", "url"] as const) {
    const where = mode === "process" ? "in process" : "at a URL";
    it(`a loader of \`x\` calling \`service({ contract: b })\`'s method for \`y\`'s \`local: true\` API entry \`b.state\` gets an \`err\`, \`y\` ${where}`, async () => {
      const { result } = await run(mode);
      expect(isErr(result), JSON.stringify(result)).toBe(true);
    });

    it(`\`y\` ${where} gets the request with \`x-keel-forwarded: 1\``, async () => {
      const { seen } = await run(mode);
      expect(seen.map((r) => `${r.path} ${r.forwarded}`)).toEqual(["/api/state 1"]);
    });

    it(`\`y\` ${where} answers 403 \`keel.denied\` with the six k.security headers`, async () => {
      const { seen } = await run(mode);
      expect(seen.map((r) => [r.status, r.denied, r.sixOk])).toEqual([[403, true, true]]);
    });

    it(`\`y\` ${where} does not run its loader`, async () => {
      const { runs } = await run(mode);
      expect(runs()).toBe(0);
    });
  }
});
