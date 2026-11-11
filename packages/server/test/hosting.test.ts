// @vitest-environment node
// Client hosting (k.hosting) on the server: allowed origins match exactly and grant API routes only (preflight,
// response headers, the write proof), W1567 once per origin, a host answers unmatched documents with the client's
// index.html, `KEEL_ALLOW_ORIGINS` parses as a list of origins, and `topology()` throws E1566. Seed 1337.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Topology } from "@keel/compiler";
import { createCtx } from "@keel/ctx";
import { action, loader, manifest } from "@keel/router";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { createApp, topology } from "../src/index.ts";
import { DeployEnv } from "../src/internal/DeployEnv.ts";
import { sameSite } from "../src/internal/sameSite.ts";
import { withCors } from "../src/internal/withCors.ts";

const SEED = 1337;
const SECRET = "s".repeat(32);
const APP = "https://app.test";
let ran = 0;

const routes = () => {
  const m = manifest({
    "a.home": { path: "/", component: () => document.createElement("main") },
    "a.lists": {
      api: true,
      path: "/api/lists",
      loader: loader({ output: s.object({ n: s.int() }) }, async () => {
        ran++;
        return ok({ n: 1 });
      }),
    },
  });
  m.actions({
    "a.lists": {
      POST: action({ input: s.object({}) }, async () => {
        ran++;
        return ok(null);
      }),
    },
  });
  return m;
};
const T = topology({ api: { modules: ["a"], adapter: "node" } });
const app = (allow: readonly string[], lines: string[] = []) =>
  createApp({
    topology: T,
    routes: routes(),
    ctx: createCtx({ mode: "sim", seed: SEED }),
    allow,
    log: { format: "compact", write: (l) => void lines.push(l) },
  });
const req = (method: string, p: string, headers: Record<string, string>): Request =>
  new Request(`http://localhost${p}`, method === "POST" ? { method, headers, body: "{}" } : { method, headers });
const json = { accept: "application/json", "content-type": "application/json" };

describe("allowed origins", () => {
  it("grants exactly the listed origin: near misses, ports, schemes, null and paths get nothing", async () => {
    const a = await app([APP, "http://local.test:3000/", "HTTPS://Case.TEST"]);
    const near = fc.constantFrom(
      "https://app.test.evil",
      "https://evil.app.test",
      "https://app.tes",
      "http://app.test",
      "https://app.test:8443",
      "https://app.test/",
      "https://APP.test",
      "null",
      "",
      "http://local.test",
      "http://local.test:3001",
    );
    await fc.assert(
      fc.asyncProperty(near, async (origin) => {
        ran = 0;
        const pre = await a.fetch(req("OPTIONS", "/api/lists", { origin, "access-control-request-method": "POST" }));
        expect(pre.status).toBe(405);
        expect(pre.headers.get("access-control-allow-origin")).toBeNull();
        const w = await a.fetch(req("POST", "/api/lists", { ...json, origin }));
        expect(w.status).toBe(403);
        expect(w.headers.get("access-control-allow-origin")).toBeNull();
        expect(ran).toBe(0);
      }),
      { seed: SEED, numRuns: 30 },
    );
    for (const origin of ["http://local.test:3000", "https://case.test", APP]) {
      const pre = await a.fetch(req("OPTIONS", "/api/lists", { origin, "access-control-request-method": "POST" }));
      expect(pre.status, origin).toBe(204);
      expect(pre.headers.get("access-control-allow-origin")).toBe(origin);
      expect(pre.headers.get("access-control-allow-methods")).toBe("GET, HEAD, POST");
    }
  });

  it("an entry that is not an http(s) origin matches nothing", async () => {
    const a = await app(["*", "null", "https://app.test/path", "file:///x", "nope"]);
    for (const origin of ["null", "*", "https://app.test", "file://"]) {
      const pre = await a.fetch(req("OPTIONS", "/api/lists", { origin, "access-control-request-method": "GET" }));
      expect(pre.status, origin).toBe(405);
    }
  });

  it("grants API routes only: a page's preflight is 405 and a page write gets no header", async () => {
    const a = await app([APP]);
    const pre = await a.fetch(req("OPTIONS", "/", { origin: APP, "access-control-request-method": "GET" }));
    expect(pre.status).toBe(405);
    const doc = await a.fetch(req("GET", "/", { origin: APP }));
    expect(doc.headers.get("access-control-allow-origin")).toBeNull();
    const w = await a.fetch(req("POST", "/", { origin: APP, "content-type": "application/json" }));
    expect(w.status).toBe(403);
  });

  it("an OPTIONS without access-control-request-method is not a preflight", async () => {
    const a = await app([APP]);
    const res = await a.fetch(req("OPTIONS", "/api/lists", { origin: APP }));
    expect(res.status).toBe(405);
    expect(res.headers.get("access-control-allow-origin")).toBe(APP);
  });

  it("a read from an allowed origin carries the two headers and vary, and keeps the caller cookie rules", async () => {
    ran = 0;
    const a = await app([APP]);
    const res = await a.fetch(req("GET", "/api/lists", { origin: APP, accept: "application/json" }));
    expect(res.status).toBe(200);
    expect(ran).toBe(1);
    expect(res.headers.get("access-control-allow-credentials")).toBe("true");
    expect(res.headers.get("vary")).toContain("origin");
    const w = await a.fetch(req("POST", "/api/lists", { ...json, origin: APP }));
    expect(w.status).toBe(200);
    expect(w.headers.get("set-cookie") ?? "").toMatch(/HttpOnly; SameSite=Lax/i);
  });

  it("W1567 is one diag per cross-site origin per app", async () => {
    const lines: string[] = [];
    const a = await app([APP, "https://two.test"], lines);
    for (const origin of [APP, APP, "https://two.test", APP, "https://two.test"])
      await a.fetch(req("GET", "/api/lists", { origin, accept: "application/json", "sec-fetch-site": "cross-site" }));
    await a.fetch(req("GET", "/api/lists", { origin: "https://three.test", "sec-fetch-site": "cross-site" }));
    const w = lines.filter((l) => l.startsWith("W1567"));
    expect(w).toHaveLength(2);
    expect(w[0]).toContain(APP);
    expect(w[1]).toContain("https://two.test");
  });
});

describe("withCors and sameSite", () => {
  it("withCors keeps status, body and headers and appends vary", async () => {
    const res = withCors(new Response("x", { status: 201, headers: { vary: "accept", a: "1" } }), APP);
    expect(res.status).toBe(201);
    expect(await res.text()).toBe("x");
    expect(res.headers.get("a")).toBe("1");
    expect(res.headers.get("vary")).toBe("accept, origin");
    expect(res.headers.get("access-control-max-age")).toBeNull();
  });

  it("an allowed request is a fourth same-site proof; without it a cross-origin write is refused", () => {
    const r = new Request("http://localhost/x", { method: "POST", headers: { origin: APP } });
    expect(sameSite(r, undefined)).toBe(false);
    expect(sameSite(r, undefined, true)).toBe(true);
  });
});

describe("host fallback", () => {
  const made: string[] = [];
  afterEach(() => {
    for (const d of made.splice(0)) fs.rmSync(d, { recursive: true, force: true });
  });
  const built = (index: boolean): string => {
    const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-host-"));
    made.push(d);
    const files: Record<string, string> = {
      ".vite/manifest.json": JSON.stringify({
        e: { file: "assets/entry-abc12345.js", isEntry: true },
        "keel:host": { file: "index.html", assets: ["assets/index-Bx_9aZ01.js"] },
      }),
      "assets/entry-abc12345.js": "resume()",
      "assets/index-Bx_9aZ01.js": "mount()",
      ...(index ? { "index.html": "<!doctype html><title>web</title>" } : {}),
    };
    for (const [rel, text] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(d, rel)), { recursive: true });
      fs.writeFileSync(path.join(d, rel), text);
    }
    return d;
  };
  const HOSTED = topology({
    api: { modules: ["a"], adapter: "node" },
    web: { modules: ["w"], adapter: "client", host: "api" },
  });
  const host = (assets: string, opts: { peers?: Record<string, string>; artifacts?: string } = {}) =>
    createApp({
      topology: HOSTED,
      deployable: "api",
      routes: routes(),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      assets,
      ...opts,
    });

  it("answers an unmatched GET or HEAD document with index.html, no-cache; runtime and event streams stay 404", async () => {
    const a = await host(built(true));
    for (const p of ["/no/such/page", "/index.html", "/x/"]) {
      const get = await a.fetch(req("GET", p, { accept: "text/html" }));
      expect(get.status, p).toBe(200);
      expect(await get.text()).toBe("<!doctype html><title>web</title>");
      expect(get.headers.get("cache-control")).toBe("no-cache");
      expect(get.headers.get("content-type")).toContain("text/html");
      const head = await a.fetch(req("HEAD", p, {}));
      expect(head.status).toBe(200);
      expect(await head.text()).toBe("");
    }
    for (const accept of ["application/json", "text/event-stream"])
      expect((await a.fetch(req("GET", "/no/such/page", { accept }))).status).toBe(404);
    expect((await a.fetch(req("POST", "/no/such/page", json))).status).toBe(404);
  });

  it("its own routes win, and the client's hashed assets are immutable", async () => {
    const a = await host(built(true));
    const home = await a.fetch(req("GET", "/", { accept: "text/html" }));
    expect(await home.text()).toContain("<main");
    const asset = await a.fetch(req("GET", "/assets/index-Bx_9aZ01.js", {}));
    expect(asset.headers.get("cache-control")).toContain("immutable");
  });

  it("a peer's path is forwarded, not answered with index.html", async () => {
    const T2 = topology({
      api: { modules: ["a"], adapter: "node" },
      other: { modules: ["b"], adapter: "node" },
      web: { modules: ["w"], adapter: "client", host: "api" },
    });
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-host-art-"));
    made.push(dir);
    fs.writeFileSync(
      path.join(dir, "routes.json"),
      JSON.stringify({ data: { "b.feed": { module: "b", path: "/feed" } }, hash: "" }),
    );
    const ctx = createCtx({ mode: "sim", seed: SEED });
    ctx.net.route("*", (r) => new Response(new URL(r.url).origin === "http://other.test" ? "peer" : "elsewhere"));
    const a = await createApp({
      topology: T2,
      deployable: "api",
      routes: routes(),
      ctx,
      assets: built(true),
      artifacts: dir,
      peers: { other: "http://other.test" },
    });
    const res = await a.fetch(req("GET", "/feed", { accept: "text/html" }));
    expect(await res.text()).toBe("peer");
  });

  it("a host without index.html rejects with E1555; a deployable no client names never serves it", async () => {
    await expect(host(built(false))).rejects.toThrow(/^E1555 assets: index.html/);
    const plain = await createApp({
      topology: T,
      routes: routes(),
      ctx: createCtx({ mode: "sim", seed: SEED }),
      assets: built(true),
    });
    expect((await plain.fetch(req("GET", "/no/such/page", { accept: "text/html" }))).status).toBe(404);
  });
});

describe("KEEL_ALLOW_ORIGINS", () => {
  const parse = (v: string) => DeployEnv([]).decodeStrings({ KEEL_SECRET: SECRET, KEEL_ALLOW_ORIGINS: v });

  it("accepts a comma-separated list of http(s) origins", () => {
    for (const v of ["https://app.test", "https://a.test, http://b.test:3000", "https://a.test/", "HTTPS://A.test"])
      expect(parse(v).ok, v).toBe(true);
  });

  it("refuses *, a path, a query, credentials or another scheme, naming the key", () => {
    const bad = fc.constantFrom(
      "*",
      "https://*.app.test",
      "https://app.test/path",
      "https://app.test?x=1",
      "https://app.test#x",
      "https://u:p@app.test",
      "ftp://app.test",
      "null",
      "https://ok.test,*",
      "https://ok.test,,https://b.test",
      "app.test",
    );
    fc.assert(
      fc.property(bad, (v) => {
        const r = parse(v);
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.data.issues[0]?.path).toEqual(["KEEL_ALLOW_ORIGINS"]);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });
});

describe("topology hosts", () => {
  it("keeps host on a client naming a node deployable", () => {
    const t = topology({
      api: { modules: ["a"], adapter: "node" },
      web: { modules: ["w"], adapter: "client", host: "api" },
    });
    expect(t.web?.host).toBe("api");
    expect(Object.isFrozen(t.web)).toBe(true);
  });

  it("throws E1566 for each bad host", () => {
    const n: Topology[string] = { modules: ["a"], adapter: "node" };
    const bad: Topology[] = [
      { api: { ...n, host: "api" } },
      { api: n, web: { modules: ["w"], adapter: "client", host: "nowhere" } },
      { api: n, pre: { modules: ["p"], adapter: "static" }, web: { modules: ["w"], adapter: "client", host: "pre" } },
      { api: n, web: { modules: ["w"], adapter: "client", host: "web" } },
      {
        api: n,
        one: { modules: ["o"], adapter: "client", host: "api" },
        two: { modules: ["t"], adapter: "client", host: "api" },
      },
    ];
    for (const def of bad) expect(() => topology(def), JSON.stringify(def)).toThrow(/^E1566 /);
  });
});
