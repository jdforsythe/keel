// The dev inspect endpoint of the Vite plugin (k.inspect, RFC 0017) and the dev entry's live reporter.
import fs from "node:fs";
import http from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import keel from "@keel/compiler/vite";
import { tempDir } from "@keel/tooling/test-tmp";
import { parseSync } from "oxc-parser";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { entryCode } from "../src/internal/entryCode.ts";
import { inspectMiddleware } from "../src/internal/inspectMiddleware.ts";

let root = "";
let server: http.Server | undefined;
let base = "";

const artifact = (name: string, data: unknown): void => {
  fs.mkdirSync(path.join(root, ".keel"), { recursive: true });
  fs.writeFileSync(path.join(root, ".keel", name), JSON.stringify({ data, hash: "fnv1a:0" }));
};

const listen = async (): Promise<void> => {
  const mw = inspectMiddleware(() => root);
  server = http.createServer((req, res) =>
    mw(req, res, () => {
      res.statusCode = 404;
      res.end("next");
    }),
  );
  const s = server;
  await new Promise<void>((resolve) => s.listen(0, "127.0.0.1", resolve));
  const addr: AddressInfo | string | null = s.address();
  base = typeof addr === "object" && addr !== null ? `http://127.0.0.1:${addr.port}` : "";
};

const post = (body: string, headers: Record<string, string> = {}): Promise<Response> =>
  fetch(`${base}/__keel/inspect`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: base, ...headers },
    body,
  });
const get = async (headers: Record<string, string> = {}): Promise<{ res: Response; json: unknown }> => {
  const res = await fetch(`${base}/__keel/inspect`, { headers });
  return { res, json: await res.json() };
};

const REPORT = {
  graph: { nodes: [{ id: 1, kind: "signal" }], edges: [] },
  stores: { "todos.board": { state: { lists: [] }, log: [] } },
};

beforeEach(async () => {
  root = tempDir(".tmp-inspect-", import.meta.dirname);
  await listen();
});
afterEach(async () => {
  const s = server;
  if (s !== undefined) await new Promise<void>((resolve) => s.close(() => resolve()));
  fs.rmSync(root, { recursive: true, force: true });
});

describe("inspectMiddleware", () => {
  it("serves the artifacts and an empty, not-live half before any page reports", async () => {
    artifact("ids.json", { "a.b": { tag: "p" } });
    artifact("a11y.json", { "a.b": { role: "paragraph" } });
    const { res, json } = await get();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(json).toEqual({
      live: false,
      graph: { nodes: [], edges: [] },
      stores: {},
      ids: { "a.b": { tag: "p" } },
      a11y: { "a.b": { role: "paragraph" } },
      routes: {},
      sections: {},
    });
  });

  it("serves the last report a same-origin page posted, and reads artifacts per request", async () => {
    expect((await post(JSON.stringify(REPORT))).status).toBe(204);
    expect((await post(JSON.stringify(REPORT), { origin: base })).status).toBe(204);
    artifact("routes.json", { "todos.index": { path: "/" } });
    const { json } = await get();
    expect(json).toMatchObject({ live: true, ...REPORT, routes: { "todos.index": { path: "/" } } });
  });

  it("serves posted inspector sections in the document, and rejects a malformed sections value", async () => {
    const sections = { "orders.recent": { doc: "recent orders", value: [1] }, bad: { doc: "d", error: "E1057 x" } };
    expect((await post(JSON.stringify({ ...REPORT, sections }))).status).toBe(204);
    expect((await get()).json).toMatchObject({ live: true, sections });
    expect((await post(JSON.stringify({ ...REPORT, sections: [] }))).status).toBe(400);
    expect((await post(JSON.stringify({ ...REPORT, sections: 1 }))).status).toBe(400);
    expect((await post(JSON.stringify(REPORT))).status).toBe(204);
    expect((await get()).json).toMatchObject({ sections: {} });
  });

  it("rejects cross-origin, non-JSON, malformed, and oversized posts and keeps the previous report", async () => {
    await post(JSON.stringify(REPORT));
    const other = { graph: { nodes: [], edges: [] }, stores: {} };
    expect((await post(JSON.stringify(other), { origin: "http://evil.example" })).status).toBe(403);
    expect((await post(JSON.stringify(other), { origin: "http://localhost:1" })).status).toBe(403);
    expect((await post(JSON.stringify(other), { origin: "http://127.0.0.1:1" })).status).toBe(403);
    expect((await post(JSON.stringify(other), { "content-type": "text/plain" })).status).toBe(403);
    expect((await post("{", {})).status).toBe(400);
    expect((await post(JSON.stringify({ graph: { nodes: [] }, stores: {} }))).status).toBe(400);
    expect((await post(JSON.stringify({ graph: { nodes: [], edges: [] }, stores: [] }))).status).toBe(400);
    expect((await post(JSON.stringify({ graph: [], stores: {} }))).status).toBe(400);
    expect((await post(JSON.stringify([1]))).status).toBe(400);
    expect(
      (await post(`{"graph":{"nodes":[],"edges":[]},"stores":{"x":"${"a".repeat(9 * 1024 * 1024)}"}}`)).status,
    ).toBe(413);
    expect((await get()).json).toMatchObject(REPORT);
  });

  it("refuses every other origin by default, loopback ports included, for GET and POST alike (RFC 0022)", async () => {
    for (const origin of ["http://localhost:4182", "http://127.0.0.1:1", "http://evil.example", "http://localhost"]) {
      const { res, json } = await get({ origin });
      expect(res.status, origin).toBe(403);
      expect(res.headers.get("access-control-allow-origin"), origin).toBeNull();
      expect(json).toMatchObject({ ok: false, error: { code: "keel.denied" } });
    }
    expect((await get({ origin: base })).res.headers.get("access-control-allow-origin")).toBeNull();
  });

  it("POST without an Origin is 403 keel.denied; GET without one is served (RFC 0022)", async () => {
    const bare = await fetch(`${base}/__keel/inspect`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(REPORT),
    });
    expect(bare.status).toBe(403);
    expect(await bare.json()).toMatchObject({ ok: false, error: { code: "keel.denied" } });
    expect((await get()).json).toMatchObject({ live: false });
    const put = await fetch(`${base}/__keel/inspect`, { method: "PUT" });
    expect(put.status).toBe(403);
    expect((await fetch(`${base}/__keel/inspect`, { method: "PUT", headers: { origin: base } })).status).toBe(405);
  });

  it("answers listed origins (`:*` any port) with CORS, and refuses a non-loopback unlisted Host", async () => {
    const s = server;
    if (s !== undefined) await new Promise<void>((resolve) => s.close(() => resolve()));
    const mw = inspectMiddleware(() => root, ["http://localhost:*", "http://dev.box:1"]);
    server = http.createServer((req, res) => mw(req, res, () => res.end("next")));
    const s2 = server;
    await new Promise<void>((resolve) => s2.listen(0, "127.0.0.1", resolve));
    const addr: AddressInfo | string | null = s2.address();
    base = typeof addr === "object" && addr !== null ? `http://127.0.0.1:${addr.port}` : "";
    for (const origin of ["http://localhost:4182", "http://localhost"]) {
      const { res } = await get({ origin });
      expect(res.headers.get("access-control-allow-origin"), origin).toBe(origin);
      expect(res.headers.get("vary")).toBe("origin");
    }
    expect((await post(JSON.stringify(REPORT), { origin: "http://localhost:4182" })).status).toBe(204);
    for (const origin of ["https://localhost:4182", "http://localhost.evil.example", "http://127.0.0.1:4182"])
      expect((await get({ origin })).res.status, origin).toBe(403);
    // DNS rebinding: the page's own origin, but a Host that is neither loopback nor listed.
    const rebound = await new Promise<number>((resolve) => {
      const r = http.request(`${base}/__keel/inspect`, { headers: { host: "rebound.example" } }, (res) => {
        res.resume();
        resolve(res.statusCode ?? 0);
      });
      r.end();
    });
    expect(rebound).toBe(403);
  });

  it("other methods are 405; other paths and a query on the path go to next / are served", async () => {
    expect((await fetch(`${base}/__keel/inspect`, { method: "PUT", headers: { origin: base } })).status).toBe(405);
    const other = await fetch(`${base}/__keel/inspectx`);
    expect([other.status, await other.text()]).toEqual([404, "next"]);
    expect((await fetch(`${base}/__keel/inspect?x=1`)).status).toBe(200);
  });

  it("a corrupt or data-less artifact reads as {}", async () => {
    fs.mkdirSync(path.join(root, ".keel"), { recursive: true });
    fs.writeFileSync(path.join(root, ".keel", "ids.json"), "{");
    fs.writeFileSync(path.join(root, ".keel", "a11y.json"), JSON.stringify({ hash: "x" }));
    const { json } = await get();
    expect(json).toMatchObject({ ids: {}, a11y: {} });
  });
});

describe("plugin wiring and dev entry", () => {
  it("registers the endpoint on the dev and preview servers", () => {
    const p = keel();
    const used: unknown[] = [];
    const middlewares = { use: (fn: unknown) => void used.push(fn) };
    p.configureServer({
      moduleGraph: { getModuleById: () => undefined },
      reloadModule: async () => {},
      middlewares,
    });
    p.configurePreviewServer({ middlewares });
    // dev: the inspect endpoint, the dev stylesheet, then the generated client document; preview: the inspect endpoint.
    expect(used).toHaveLength(4);
    expect(used[0]).toBe(used[3]);
  });

  it("the entry reports graph and stores to /__keel/inspect in dev builds only, and parses as JS", () => {
    const code = entryCode(["/modules/todos/routes.ts"], "virtual:keel.css");
    expect(code).toContain('import { inspect } from "@keel/reactive";');
    expect(code).toContain('import { stores } from "@keel/store";');
    expect(code).toContain('import { inspectorSections } from "@keel/compiler/inspect/inspectorSections";');
    expect(code).toContain('if (mode === "dev") {');
    expect(code).toContain('const mode = "production";');
    expect(code).not.toContain("import.meta.env");
    expect(code).toContain('fetch("/__keel/inspect", { method: "POST"');
    expect(code).toContain(
      "JSON.stringify({ graph: inspect(), stores: live, sections: inspectorSections(ctx).sections })",
    );
    expect(code).toContain("setInterval(report, 1000);");
    expect(code.indexOf("mount(router.App")).toBeLessThan(code.indexOf("report();"));
    expect(parseSync("entry.js", code, { sourceType: "module" }).errors).toEqual([]);
  });

  it("with its deployable's name the entry posts it as deployable beside the sections", () => {
    const code = entryCode(
      ["/modules/todos/routes.ts"],
      "virtual:keel.css",
      {},
      {},
      undefined,
      "dev",
      false,
      true,
      "web",
    );
    expect(code).toContain(
      'JSON.stringify({ graph: inspect(), stores: live, sections: inspectorSections(ctx).sections, deployable: "web" })',
    );
    expect(parseSync("entry.js", code, { sourceType: "module" }).errors).toEqual([]);
  });
});
