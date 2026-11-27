// @vitest-environment happy-dom
// Spec: k.topology, clause "With `x` forwarding to `y` and `y`'s `routes.json` marking page `b.tools` at `/tools` `local: true`, a `GET /tools` to `x` from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none` answers 403 `keel.denied` carrying the six k.security headers, and `y` receives no request."
// k.topology Calls and peers: "A request for a route the peer's `routes.json` marks `local` (k.contract Local routes) is never forwarded, from any address: the forwarding deployable answers 403 `keel.denied` itself, with the k.security headers, and sends the peer nothing."
// Seed 1337 (fast-check: the connection's remote address, `Host` and `Sec-Fetch-Site`). Fixture: as topology-forwarding-unserved-paths.test.ts (`x` serves `a`, `y` serves `b`, `x` names `y` in `peers` by URL `http://y.test`, `routes.json` in `artifacts`), page `b.tools` `local: true`, page `b.open` not.
// ASSUMED: (1) `routesArtifact` writes `local: true` for a `local` entry (k.contract: ".keel/routes.json ... marks that entry `local: true`"); (2) the connection is the shape `createApp`'s `fetch(request, connection)` reads: `{ incoming: { socket: { remoteAddress } } }`; (3) the 403 body holds the text `keel.denied`.
import { createCtx } from "@keel/ctx";
import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import * as server from "@keel/server";
import { topology } from "@keel/server";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, writeArtifacts, withHeaders } from "./topology-fixtures.ts";

type Conn = { incoming: { socket: { remoteAddress: string } } };
type App = { fetch(req: Request, connection?: Conn): Promise<Response> };
const isApp = (v: unknown): v is App =>
  typeof v === "object" && v !== null && "fetch" in v && typeof v.fetch === "function";
const make = async (o: Record<string, unknown>): Promise<App> => {
  const f: unknown = Reflect.get(server, "createApp");
  if (typeof f !== "function") throw new Error("@keel/server does not export createApp");
  const app: unknown = await Reflect.apply(f, undefined, [o]);
  if (!isApp(app)) throw new Error("createApp did not return an app with fetch");
  return app;
};
const conn = (remoteAddress: string): Conn => ({ incoming: { socket: { remoteAddress } } });

const Page = s.object({ title: s.string() });
const page = (): Node => document.createElement("main");
const b = () => {
  const c = contract("b", { "b.tools": { path: "/tools", local: true }, "b.open": { path: "/open" } });
  const tools = loader(c, "b.tools", { output: Page }, () => Promise.resolve(ok({ title: "tools" })));
  const open = loader(c, "b.open", { output: Page }, () => Promise.resolve(ok({ title: "open" })));
  return manifest(c, { "b.tools": { component: page, loader: tools }, "b.open": { component: page, loader: open } });
};
const a = () => {
  const c = contract("a", { "a.home": { path: "/a" } });
  return manifest(c, { "a.home": { component: page } });
};

const SIX: Record<string, string> = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "same-origin",
  "cross-origin-opener-policy": "same-origin",
  "cross-origin-resource-policy": "same-origin",
  "x-frame-options": "DENY",
  "permissions-policy": "camera=(), microphone=(), payment=(), usb=()",
};

const PORT = 4317;
/** `x` forwarding to `y`; `seen` holds each request `y` receives. */
async function pair(): Promise<{ x: App; seen: Request[] }> {
  const t = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });
  const y = await make({ topology: t, deployable: "y", routes: b(), ctx: createCtx({ mode: "sim", seed: SEED }) });
  const seen: Request[] = [];
  const xCtx = createCtx({ mode: "sim", seed: SEED });
  xCtx.net.route("http://y.test/*", (req) => {
    seen.push(req.clone());
    return y.fetch(req, conn("127.0.0.1"));
  });
  const x = await make({
    topology: t,
    deployable: "x",
    routes: a(),
    ctx: xCtx,
    peers: { y: "http://y.test" },
    artifacts: writeArtifacts(b()),
  });
  return { x, seen };
}
const get = (path: string, extra: Record<string, string>): Request =>
  withHeaders(new Request(`http://127.0.0.1:${PORT}${path}`, { headers: { accept: "application/json" } }), extra);
const six = (res: Response, label: string): void => {
  for (const [name, value] of Object.entries(SIX)) expect(res.headers.get(name), `${label}: ${name}`).toBe(value);
};

describe("k.topology Calls and peers: a `local` route of a peer is never forwarded", () => {
  it("With `x` forwarding to `y` and `y`'s `routes.json` marking page `b.tools` at `/tools` `local: true`, a `GET /tools` to `x` from `127.0.0.1` with `Host: 127.0.0.1:<port>` and `Sec-Fetch-Site: none` answers 403 `keel.denied` carrying the six k.security headers, and `y` receives no request", async () => {
    const { x, seen } = await pair();
    const res = await x.fetch(
      get("/tools", { host: `127.0.0.1:${PORT}`, "sec-fetch-site": "none" }),
      conn("127.0.0.1"),
    );
    expect(res.status).toBe(403);
    expect(await res.text()).toContain("keel.denied");
    six(res, "loopback");
    expect(seen).toHaveLength(0);
  });

  it("a request for a `local` route of the peer is not forwarded from any remote address, loopback included, nor with no connection", async () => {
    const octet = fc.integer({ min: 0, max: 255 });
    const address = fc.oneof(
      fc.constantFrom("127.0.0.1", "::1", "::ffff:127.0.0.1", "10.0.0.5", "192.168.1.5"),
      fc.tuple(octet, octet, octet, octet).map((p) => p.join(".")),
    );
    const { x, seen } = await pair();
    await fc.assert(
      fc.asyncProperty(fc.option(address, { nil: undefined }), async (addr) => {
        const res = await x.fetch(
          get("/tools", { host: `127.0.0.1:${PORT}`, "sec-fetch-site": "none" }),
          addr === undefined ? undefined : conn(addr),
        );
        expect(res.status, String(addr)).toBe(403);
        expect(await res.text(), String(addr)).toContain("keel.denied");
        six(res, String(addr));
        expect(seen, String(addr)).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it("a `local` route of the peer is not forwarded whatever the `Host` and `Sec-Fetch-Site` of the request", async () => {
    const { x, seen } = await pair();
    const host = fc.constantFrom(`127.0.0.1:${PORT}`, `localhost:${PORT}`, `[::1]:${PORT}`, "example.com", "x.test");
    const site = fc.constantFrom("none", "same-origin", "same-site", "cross-site");
    await fc.assert(
      fc.asyncProperty(host, site, async (h, f) => {
        const res = await x.fetch(get("/tools", { host: h, "sec-fetch-site": f }), conn("127.0.0.1"));
        expect(res.status, `${h} ${f}`).toBe(403);
        six(res, `${h} ${f}`);
        expect(seen, `${h} ${f}`).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("a route of the peer that is not `local` is still forwarded under the same request", async () => {
    const { x, seen } = await pair();
    const res = await x.fetch(get("/open", { host: `127.0.0.1:${PORT}`, "sec-fetch-site": "none" }), conn("127.0.0.1"));
    expect(res.status).toBe(200);
    expect(seen).toHaveLength(1);
  });
});
