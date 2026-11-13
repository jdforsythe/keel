// @vitest-environment node
// A peer's response comes back without its hop-by-hop headers, those its `connection` names, `content-encoding` and
// `content-length` (k.topology Calls and peers). A local http server the test starts and closes plays the peer.
import http from "node:http";
import { createCtx } from "@keel/ctx";
import { manifest } from "@keel/router";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import type { Served } from "../src/internal/Served.ts";
import { callerSigner } from "../src/internal/callerSigner.ts";
import { forward } from "../src/internal/forward.ts";
import { stripHop } from "../src/internal/stripHop.ts";

const SEED = 1337;

const port = (a: ReturnType<http.Server["address"]>): number => (typeof a === "object" && a !== null ? a.port : 0);

describe("forwarded response headers", () => {
  it("strips hop-by-hop, connection-named, content-encoding and content-length; keeps the rest", async () => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, {
        "x-keep": "1",
        "x-named": "n",
        connection: "x-named",
        "keep-alive": "timeout=5",
        "content-type": "text/plain",
      });
      res.end("hello");
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    try {
      const at = port(server.address());
      const ctx = createCtx({ mode: "real" });
      const sv: Served = {
        table: [],
        ctx,
        mode: "production",
        routes: manifest({}),
        maxBody: 1024,
        inspectOrigins: [],
        keys: await callerSigner(undefined),
        secure: undefined,
        built: undefined,
        entry: "/@keel/entry.ts",
        name: "x",
        origin: undefined,
        allow: new Set(),
        lifecycle: new AbortController(),
        maxStreams: 1000,
        streams: { open: 0 },
        reports: { open: false, logged: 0, dropped: 0, sources: new Map() },
        frames: () => [],
      };
      const out = await forward(new Request("http://x.test/p"), `http://127.0.0.1:${at}`, sv);
      const h = out.response.headers;
      expect(await out.response.text()).toBe("hello");
      expect(h.get("x-keep")).toBe("1");
      expect(h.get("content-type")).toBe("text/plain");
      for (const n of ["x-named", "keep-alive", "connection", "content-length", "content-encoding"])
        expect(h.has(n)).toBe(false);
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  });
});

describe("forwarded HEAD response", () => {
  const serve = async (head: Record<string, string>) => {
    const server = http.createServer((_req, res) => {
      res.writeHead(200, head);
      res.end();
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    const sv: Served = {
      table: [],
      ctx: createCtx({ mode: "real" }),
      mode: "production",
      routes: manifest({}),
      maxBody: 1024,
      inspectOrigins: [],
      keys: await callerSigner(undefined),
      secure: undefined,
      built: undefined,
      entry: "/@keel/entry.ts",
      name: "x",
      origin: undefined,
      allow: new Set(),
      lifecycle: new AbortController(),
      maxStreams: 1000,
      streams: { open: 0 },
      reports: { open: false, logged: 0, dropped: 0, sources: new Map() },
      frames: () => [],
    };
    return { server, sv, at: port(server.address()) };
  };
  const close = (s: http.Server) => new Promise<void>((r) => s.close(() => r()));

  it("keeps the peer's content-length", async () => {
    const { server, sv, at } = await serve({ "content-type": "text/plain", "content-length": "5" });
    try {
      const out = await forward(new Request("http://x.test/p", { method: "HEAD" }), `http://127.0.0.1:${at}`, sv);
      expect(out.response.headers.get("content-length")).toBe("5");
    } finally {
      await close(server);
    }
  });

  it("drops content-length when the peer response carried a content-encoding", async () => {
    const { server, sv, at } = await serve({ "content-encoding": "gzip", "content-length": "5" });
    try {
      const out = await forward(new Request("http://x.test/p", { method: "HEAD" }), `http://127.0.0.1:${at}`, sv);
      expect(out.response.headers.has("content-length")).toBe(false);
      expect(out.response.headers.has("content-encoding")).toBe(false);
    } finally {
      await close(server);
    }
  });
});

describe("stripHop", () => {
  const name = fc.stringMatching(/^[a-z][a-z0-9-]{0,12}$/);
  it("drops exactly the hop-by-hop, connection-named and extra names (seed 1337)", () => {
    fc.assert(
      fc.property(
        fc.array(name, { maxLength: 8 }),
        fc.array(name, { maxLength: 3 }),
        fc.array(name, { maxLength: 3 }),
        (names, conn, more) => {
          const h = new Headers();
          for (const n of names) h.set(n, "v");
          if (conn.length > 0) h.set("connection", conn.join(", "));
          const out = stripHop(h, more);
          for (const k of out.keys()) {
            expect(conn).not.toContain(k);
            expect(more).not.toContain(k);
            expect(k).not.toMatch(/^(connection|keep-alive|transfer-encoding|te|trailer|upgrade|proxy-.*)$/);
          }
          for (const k of h.keys())
            if (!out.has(k))
              expect(
                conn.includes(k) ||
                  more.includes(k) ||
                  /^(connection|keep-alive|transfer-encoding|te|trailer|upgrade|expect|host|content-length|proxy-.*)$/.test(
                    k,
                  ),
              ).toBe(true);
        },
      ),
      { seed: SEED, numRuns: 100 },
    );
  });
});
