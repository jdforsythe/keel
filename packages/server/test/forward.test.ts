// @vitest-environment node
// Forwarding to a peer (k.topology Calls and peers): the peer's origin is the only origin a forwarded request reaches,
// redirects pass through, the body is capped, hop-by-hop headers stay behind, an unreachable peer is 502 and every
// forwarded request writes its `req` line. Seed 1337; the peer answers through sim net routes, no wall time.
import fs from "node:fs";
import path from "node:path";
import { type Ctx, createCtx } from "@keel/ctx";
import { type RouteTable, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { tempDir } from "@keel/tooling/test-tmp";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import type { Served } from "../src/internal/Served.ts";
import { callerSigner } from "../src/internal/callerSigner.ts";
import { forward } from "../src/internal/forward.ts";

const SEED = 1337;
const PEER = "http://y.internal:8080";
const T = topology({ x: { modules: ["a"], adapter: "node" }, y: { modules: ["b"], adapter: "node" } });

const aX = contract("a", { "a.x": { path: "/a" } });
const aXLoad = loader(aX, "a.x", { output: s.object({ t: s.string() }) }, async () => ok({ t: "a.x" }));
const page = (): RouteTable =>
  manifest(aX, { "a.x": { loader: aXLoad, component: () => document.createElement("p") } });

/** `routes.json` in a fresh artifacts directory: `y`'s module `b` serves `paths`. */
function artifacts(paths: readonly string[]): string {
  const dir = tempDir("keel-forward-");
  const data = Object.fromEntries(paths.map((p, i) => [`b.r${i}`, { module: "b", path: p }]));
  fs.writeFileSync(path.join(dir, "routes.json"), JSON.stringify({ data, hash: "" }));
  return dir;
}

/** The front `x` (serving `/a`) with `y` at `PEER` serving `/:slug`, `/digest/feed` and `/b/save`; `seen` gets every peer request. */
async function front(answer: (req: Request) => Response | Promise<Response>, maxBodyBytes?: number) {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  const seen: Request[] = [];
  ctx.net.route("*", (req) => {
    seen.push(req);
    return answer(req);
  });
  const lines: string[] = [];
  const app = await createApp({
    topology: T,
    deployable: "x",
    routes: page(),
    ctx,
    peers: { y: PEER },
    artifacts: artifacts(["/:slug", "/digest/feed", "/b/save"]),
    log: { format: "compact", write: (l) => lines.push(l) },
    ...(maxBodyBytes === undefined ? {} : { maxBodyBytes }),
  });
  return { app, seen, lines };
}

async function served(ctx: Ctx): Promise<Served> {
  return {
    table: [],
    ctx,
    mode: "production",
    routes: routeTable(),
    byId: new Map(),
    maxBody: 1024,
    inspectOrigins: [],
    keys: await callerSigner(undefined),
    secure: undefined,
    built: undefined,
    css: [],
    entry: "/@keel/entry.ts",
    name: "x",
    origin: undefined,
    allow: new Set(),
    lifecycle: new AbortController(),
    maxStreams: 1000,
    streams: { open: 0 },
    eager: new Set(),
    nothing: new Set(),
    reports: { open: false, logged: 0, dropped: 0, sources: new Map() },
    frames: () => [],
  };
}

const segment = fc.stringMatching(/^[a-z0-9.:@\\%/?#-]{0,12}$/);

describe("forward", () => {
  it("fetches every forwarded path from the peer's origin, whatever the path", async () => {
    const ctx = createCtx({ mode: "sim", seed: SEED });
    const urls: string[] = [];
    ctx.net.route("*", (req) => {
      urls.push(req.url);
      return new Response("peer");
    });
    const sv = await served(ctx);
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("/", "//", "/\\", "///", "/./"), segment, async (lead, rest) => {
        const at = `http://front.example${lead}${rest}`;
        fc.pre(URL.canParse(at));
        const h = await forward(new Request(at), PEER, sv);
        expect(h.response.status).toBe(200);
        expect(new URL(urls.at(-1) ?? "").origin).toBe(PEER);
        expect(new URL(urls.at(-1) ?? "").pathname).toBe(new URL(at).pathname);
      }),
      { seed: SEED, numRuns: 300 },
    );
  });

  it("never forwards a path starting `//` or `/\\`: it is answered as an unserved path", async () => {
    const { app, seen } = await front(() => new Response("peer"));
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("//", "/\\"), fc.domain(), async (lead, host) => {
        const res = await app.fetch(
          new Request(`http://front.example${lead}${host}`, { headers: { cookie: "__Host-keel-caller=s" } }),
        );
        expect(res.status).toBe(404);
        expect(seen).toHaveLength(0);
      }),
      { seed: SEED, numRuns: 50 },
    );
    expect((await app.fetch(new Request("http://front.example//digest/feed"))).status).toBe(404);
    expect(seen).toHaveLength(0);
    expect((await app.fetch(new Request("http://front.example/digest/feed"))).status).toBe(200);
    expect(seen.map((r) => r.url)).toEqual([`${PEER}/digest/feed`]);
  });

  it("does not follow a peer redirect: the 3xx, its location and set-cookie reach the caller", async () => {
    const { app, seen } = await front(
      () => new Response(null, { status: 303, headers: { location: "/b", "set-cookie": "keel-caller=t; HttpOnly" } }),
    );
    const res = await app.fetch(new Request("http://front.example/b/save", { method: "POST", body: "a=1" }));
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("/b");
    expect(res.headers.get("set-cookie")).toBe("keel-caller=t; HttpOnly");
    expect(seen[0]?.redirect).toBe("manual");
  });

  it("answers a body over maxBodyBytes with 413 keel.payloadTooLarge and sends nothing", async () => {
    const { app, seen } = await front(() => new Response("peer"), 16);
    const fits = await app.fetch(new Request("http://front.example/b/save", { method: "POST", body: "x".repeat(16) }));
    expect(fits.status).toBe(200);
    expect(await seen[0]?.text()).toBe("x".repeat(16));
    const over = await app.fetch(new Request("http://front.example/b/save", { method: "POST", body: "x".repeat(17) }));
    expect(over.status).toBe(413);
    expect(await over.json()).toMatchObject({
      ok: false,
      error: { code: "keel.payloadTooLarge", data: { limit: 16 } },
    });
    expect(seen).toHaveLength(1);
  });

  it("drops hop-by-hop headers and those `connection` names; keeps the rest", async () => {
    const { app, seen } = await front(() => new Response("peer"));
    const hop = {
      connection: "keep-alive, X-Drop",
      "x-drop": "1",
      "keep-alive": "timeout=5",
      "transfer-encoding": "chunked",
      expect: "100-continue",
      upgrade: "h2c",
      te: "trailers",
      trailer: "x-sum",
      "proxy-authorization": "Basic eA==",
      "proxy-connection": "keep-alive",
    };
    const res = await app.fetch(
      new Request("http://front.example/b/save", {
        method: "POST",
        body: "hello",
        headers: { ...hop, "x-trace": "t1", cookie: "c=1", "content-type": "text/plain" },
      }),
    );
    expect(res.status).toBe(200);
    const sent = seen[0]?.headers;
    for (const h of Object.keys(hop)) expect(sent?.has(h), h).toBe(false);
    expect(sent?.get("x-trace")).toBe("t1");
    expect(sent?.get("cookie")).toBe("c=1");
    expect(sent?.get("x-keel-forwarded")).toBe("1");
    expect(await seen[0]?.text()).toBe("hello");
  });

  it("answers an unreachable peer with 502 keel.unreachable, a diag and the req line", async () => {
    const { app, lines } = await front(() => {
      throw new TypeError("fetch failed");
    });
    const res = await app.fetch(new Request("http://front.example/b/save"));
    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain('"code":"keel.unreachable"');
    expect(body).not.toContain("fetch failed");
    expect(JSON.parse(body)).toEqual({
      ok: false,
      error: { code: "keel.unreachable", message: "peer unreachable", data: {} },
    });
    expect(lines).toEqual(["keel.unreachable peer unreachable: TypeError", "GET /b/save 502 0ms"]);
  });

  it("writes one req line per forwarded request", async () => {
    const { app, lines } = await front(() => new Response("peer", { status: 201 }));
    await app.fetch(new Request("http://front.example/digest/feed?q=1"));
    expect(lines).toEqual(["GET /digest/feed 201 0ms"]);
  });
});
