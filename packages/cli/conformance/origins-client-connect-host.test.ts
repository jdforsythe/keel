// Spec: k.origins, Conformance "A `client` deployable with `connect: { 'https://api.test': 'r', 'https://c.example': 'r' }` and `KEEL_PEER_API=https://api.test`: `csp.txt` has `connect-src 'self' https://api.test https://c.example`; its `host` serves it with that policy; the host's own documents lack `https://c.example`."
// Spec: k.origins, Policy "(in `connect-src` after the `keel-peer` origins; one equal to a peer once, in its place)"; "the `client` `index.html` a `host` serves (the `client`'s origins, not the host's)"
// Seed 1337 (no generated input: one fixture, a built server on a free port, no timers).
// ASSUMPTIONS: `node dist/a/server.mjs` with `PORT` and `KEEL_SECRET` as k.hosting's conformance runs it; the policy of the served `index.html` is its `Content-Security-Policy` header;
// the host `a` has a route `/a` (a document of its own) and `KEEL_PEER_API` names the node deployable `api`.
import { spawn } from "node:child_process";
import http from "node:http";
import net from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { cleanup, materialize } from "./compat-support.ts";
import { SLOW, build, cspTxt, directivesOf, tree } from "./origins-support.ts";

const TOPOLOGY =
  "{ api: { modules: ['a'], adapter: 'node' }, w: { modules: ['c'], adapter: 'client', host: 'api', " +
  "origins: { connect: { 'https://api.test': 'r', 'https://c.example': 'r' } } } }";
let dir = "";
beforeAll(() => {
  dir = materialize(tree(TOPOLOGY));
  expect(build(dir, { KEEL_PEER_API: "https://api.test" })).toBe(0);
}, SLOW);
afterAll(() => cleanup(dir));

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });
const get = (port: number, path: string): Promise<{ status: number; policy: string }> =>
  new Promise((resolve, reject) => {
    const req = http.request(
      { host: "127.0.0.1", port, method: "GET", path, headers: { accept: "text/html" } },
      (res) => {
        res.resume();
        res.on("end", () =>
          resolve({ status: res.statusCode ?? 0, policy: String(res.headers["content-security-policy"] ?? "") }),
        );
      },
    );
    req.on("error", reject);
    req.end();
  });

async function withServer(fn: (port: number) => Promise<void>): Promise<void> {
  const port = await freePort();
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v !== undefined && !k.startsWith("VITEST") && !k.startsWith("KEEL_") && k !== "NODE_OPTIONS" && k !== "TEST")
      env[k] = v;
  }
  const child = spawn(process.execPath, [join(dir, "dist", "api", "server.mjs")], {
    cwd: dir,
    env: { ...env, PORT: String(port), KEEL_SECRET: "s".repeat(32) },
    stdio: "ignore",
  });
  try {
    let up = false;
    for (let i = 0; i < 4000 && !up; i++)
      up = await get(port, "/").then(
        () => true,
        () => false,
      );
    expect(up).toBe(true);
    await fn(port);
  } finally {
    child.kill("SIGTERM");
  }
}

describe("k.origins: a client deployable's connect origins", () => {
  test(
    "`csp.txt` has `connect-src 'self' https://api.test https://c.example`, the peer once, in the peer's place",
    () => {
      const ds = directivesOf(cspTxt(dir, "w"));
      expect(ds).toContain("connect-src 'self' https://api.test https://c.example");
    },
    SLOW,
  );

  test(
    "its `host` serves the `index.html` with that policy",
    async () => {
      await withServer(async (port) => {
        const res = await get(port, "/");
        expect(res.status).toBe(200);
        expect(directivesOf(res.policy)).toContain("connect-src 'self' https://api.test https://c.example");
      });
    },
    SLOW,
  );

  test(
    "the host's own documents lack `https://c.example`",
    async () => {
      await withServer(async (port) => {
        const res = await get(port, "/a");
        expect(res.status).toBe(200);
        expect(res.policy).not.toBe("");
        expect(res.policy).not.toContain("https://c.example");
      });
    },
    SLOW,
  );
});
