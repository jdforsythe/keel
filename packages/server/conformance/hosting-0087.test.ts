// @vitest-environment happy-dom
// Spec: k.hosting, clause "`keel build` of a fixture with a `client` deployable `web` writes `dist/web/index.html` and hashed files under `dist/web/assets/`; no file in it holds a URL that is neither root-absolute nor absolute."
// Spec: k.hosting, clause "With `KEEL_PEER_API=https://api.test` the built `index.html` has one `keel-peer` tag for `api`, and a `service({ contract })` call from the client entry under a sim ctx fetches `https://api.test` plus the path with credentials included; unset, the call goes to the document's origin; `KEEL_PEER_API=nope` fails the build with one E1565 naming the key."
// Spec: k.hosting, clause "With `allow: ['https://app.test']`: a preflight from that origin to an API route is 204 with the six headers; a POST from it runs the action and carries the two response headers; the same requests from `https://other.test` are 405 and 403; a preflight to a page is 405."
// Spec: k.hosting, clause "`KEEL_ALLOW_ORIGINS=*` exits 1 with one E1560 naming the key."
// Spec: k.hosting, clause "A request from an allowed origin with `sec-fetch-site: cross-site` logs W1567 once for that origin."
// Spec: k.hosting, clause "With `servedBy: 'api'`, `node dist/api/server.mjs` answers `GET /` and `GET /no/such/page` with the client `index.html`, an unmatched runtime GET with 404, and a client asset as `immutable`; `servedBy` naming a `client` deployable is E1566."
// Spec: k.hosting, clause "A deployable with `host: 'api'` is one E1552 naming `host` (k.topology); `topology()` throws E1552 for it."
// Spec: k.topology Rules "A deployable key the Declaration omits is E1552 too."
// Spec: k.hosting Rules E1565, E1566, W1567
// Seed 1337.
// ASSUMPTIONS: `createApp({ allow: string[] })`; `topology({ <name>: { servedBy } })`; `KEEL_ALLOW_ORIGINS` is read by the built `server.mjs`;
// the client artifact copy lands at `dist/<servedBy>/index.html` and `dist/<servedBy>/assets/`; the W1567 diag is a JSON log line with kind "diag" (dev mode sink).
// The `service({ contract })` binding of the `keel-peer` tags is observed in packages/cli/conformance/hosting-peer-binding.test.ts.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { topology } from "@keel/server";
import { action, guard, loader, manifest, routeTable } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { afterAll, describe, expect, test } from "vitest";
import { post, SEED } from "./fixtures.ts";
import { deployEnv, REPO } from "./topology-build-fixture.ts";
import { createAppLoose, simCtx, withHeaders } from "./topology-fixtures.ts";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) fs.rmSync(r, { recursive: true, force: true });
});

// ---- built fixtures -------------------------------------------------------------------------------------------

const COUNTER = `import { signal } from "@keel/reactive";
import { Box, Button, Text } from "@keel/ui";
export default function Counter() {
  const n = signal(0);
  return <Box><Button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</Button><Text id="c.out">{n.get()}</Text></Box>
}
`;

function write(root: string, rel: string, content: string): void {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
}
function link(target: string, at: string): void {
  fs.mkdirSync(path.dirname(at), { recursive: true });
  fs.symlinkSync(target, at);
}

const WEB_AND_API = `{ api: { modules: ["api"], adapter: "node" }, web: { modules: ["app"], adapter: "client" } }`;

interface Built {
  root: string;
  status: number | null;
  out: string;
}

/** Write a fixture with the given `topology({...})` argument text, run the real `keel build` with `env`, return the result. */
function buildFixture(topologyArg: string, env: Record<string, string> = {}): Built {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-hosting-")));
  roots.push(root);
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"]) {
    link(path.join(REPO, "packages", p), path.join(root, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(root, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(root, "node_modules", ".bin", "vite"));
  write(root, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(root, "topology.ts", `import { topology } from "@keel/server";\nexport default topology(${topologyArg});\n`);
  write(
    root,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    root,
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: {
        jsx: "react-jsx",
        jsxImportSource: "@keel/runtime-dom",
        module: "esnext",
        target: "es2022",
        moduleResolution: "bundler",
      },
    }),
  );
  write(root, "modules/app/Counter.tsx", COUNTER);
  write(
    root,
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    root,
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nimport Counter from "./Counter.tsx";\nexport const routes = manifest(app, { "app.home": { component: Counter } });\n',
  );
  write(
    root,
    "modules/app/app.contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
  );
  write(
    root,
    "modules/api/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "api", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    root,
    "modules/api/routes.ts",
    'import { manifest } from "@keel/router";\nimport { api } from "./api.contract.ts";\nimport { ping } from "./ping.server.ts";\nexport const routes = manifest(api, { "api.ping": { loader: ping } });\n',
  );
  write(
    root,
    "modules/api/api.contract.ts",
    'import { contract } from "@keel/router/contract";\nimport { s } from "@keel/schema";\nexport const api = contract("api", { "api.ping": { method: "GET", path: "/api/ping", output: s.object({ n: s.int() }) } });\n',
  );
  write(
    root,
    "modules/api/ping.server.ts",
    'import { loader } from "@keel/router";\nimport { ok } from "@keel/schema";\nimport { api } from "./api.contract.ts";\nexport const ping = loader(api, "api.ping", {}, async () => ok({ n: 1 }));\n',
  );
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: root,
    encoding: "utf8",
    env: deployEnv({ KEEL_AGENT: "1", ...env }),
  });
  return { root, status: r.status, out: `${r.stdout}${r.stderr}` };
}

function filesUnder(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? filesUnder(p) : [p];
  });
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

interface Reply {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
}
function send(port: number, method: string, urlPath: string, headers: Record<string, string> = {}): Promise<Reply> {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port, method, path: urlPath, headers }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () =>
        resolve({ status: res.statusCode ?? 0, headers: res.headers, body: Buffer.concat(chunks).toString("utf8") }),
      );
    });
    req.on("error", reject);
    req.end();
  });
}

/** Run `node dist/<name>/server.mjs` on a free port, wait for it to answer (bounded retry, no timers), run `fn`, kill only that child. */
async function withServer(root: string, name: string, fn: (port: number) => Promise<void>): Promise<void> {
  const port = await freePort();
  const child = spawn(process.execPath, [path.join(root, "dist", name, "server.mjs")], {
    cwd: root,
    env: deployEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32) }),
    stdio: "ignore",
  });
  try {
    let up = false;
    for (let i = 0; i < 4000 && !up; i++) {
      up = await send(port, "GET", "/", { accept: "application/json" }).then(
        () => true,
        () => false,
      );
    }
    expect(up).toBe(true);
    await fn(port);
  } finally {
    child.kill("SIGTERM");
  }
}

const keelPeerTags = (html: string): string[] => html.match(/<meta\b[^>]*name="keel-peer"[^>]*>/g) ?? [];

// ---- createApp fixtures ---------------------------------------------------------------------------------------

const count = { guard: 0, loader: 0, action: 0 };
const Out = s.object({ n: s.int() });
const allowGuard = guard({}, async () => {
  count.guard++;
  return ok(null);
});
const opsContract = contract("ops", { "ops.home": { path: "/" } });
const apiContract = contract("api", {
  "api.getLists": { method: "GET", path: "/api/lists", output: Out },
  "api.postLists": { method: "POST", path: "/api/lists", body: s.object({ note: s.string() }), output: s.object({}) },
});
const read = loader(apiContract, "api.getLists", {}, async () => {
  count.loader++;
  return ok({ n: 7 });
});
const write2 = action(apiContract, "api.postLists", {}, async () => {
  count.action++;
  return ok({});
});
const page = (): Node => document.createElement("main");
const topo = topology({ web: { modules: ["api", "ops"], adapter: "node" } });
const ALLOWED = "https://app.test";

async function boot(extra: Record<string, unknown> = {}) {
  const routes = routeTable(
    manifest(opsContract, { "ops.home": { component: page } }),
    manifest(apiContract, {
      "api.getLists": { loader: read, guard: allowGuard },
      "api.postLists": { action: write2, guard: allowGuard },
    }),
  );
  return createAppLoose({ topology: topo, routes, ctx: simCtx(), mode: "production", allow: [ALLOWED], ...extra });
}
const reset = (): void => {
  count.guard = 0;
  count.loader = 0;
  count.action = 0;
};
const preflight = (urlPath: string, origin: string, method = "POST"): Request =>
  withHeaders(new Request(`http://localhost${urlPath}`, { method: "OPTIONS" }), {
    origin,
    "access-control-request-method": method,
  });
const tokens = (v: string | null): string[] => (v ?? "").split(",").map((t) => t.trim().toLowerCase());

describe("k.hosting", () => {
  test("`keel build` of a fixture with a `client` deployable `web` writes `dist/web/index.html` and hashed files under `dist/web/assets/`; no file in it holds a URL that is neither root-absolute nor absolute.", () => {
    const b = buildFixture(WEB_AND_API);
    expect(b.status).toBe(0);
    const dist = path.join(b.root, "dist", "web");
    expect(fs.existsSync(path.join(dist, "index.html"))).toBe(true);
    const assets = fs.readdirSync(path.join(dist, "assets"));
    expect(assets.length).toBeGreaterThan(0);
    for (const f of assets) expect(f).toMatch(/[-.][A-Za-z0-9_-]{6,}\.[a-z0-9]+$/);
    expect(fs.existsSync(path.join(dist, "keel-mark.svg"))).toBe(true);
    const absolute = (u: string): boolean => /^\/(?!\/)/.test(u) || /^https?:\/\//.test(u) || /^(data:|#)/.test(u);
    for (const file of filesUnder(dist)) {
      const text = fs.readFileSync(file, "utf8");
      if (file.endsWith(".html")) {
        for (const m of text.matchAll(/\b(?:src|href|content)="([^"]*)"/g)) {
          const v = m[1] ?? "";
          if (/^[./]/.test(v) || /^[a-z0-9_-]+\.[a-z0-9]+$/i.test(v)) expect(absolute(v), `${file}: ${v}`).toBe(true);
        }
      }
      if (file.endsWith(".css")) {
        for (const m of text.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g))
          expect(absolute(m[1] ?? ""), `${file}: ${m[1]}`).toBe(true);
      }
      if (file.endsWith(".js")) expect(text).not.toMatch(/(?:from\s*|import\s*\(?\s*)["']\.{1,2}\//);
    }
  }, 180_000);

  test("E1565 / With `KEEL_PEER_API=https://api.test` the built `index.html` has one `keel-peer` tag for `api`; `service({ contract })` binding (packages/cli/conformance/hosting-peer-binding.test.ts); `KEEL_PEER_API=nope` fails the build with one E1565 naming the key.", () => {
    const set = buildFixture(WEB_AND_API, { KEEL_PEER_API: "https://api.test" });
    expect(set.status).toBe(0);
    const html = fs.readFileSync(path.join(set.root, "dist", "web", "index.html"), "utf8");
    const tags = keelPeerTags(html);
    expect(tags).toHaveLength(1);
    expect(tags[0]).toContain('data-deployable="api"');
    expect(tags[0]).toContain('content="https://api.test"');
    const entries = filesUnder(path.join(set.root, "dist", "web", "assets")).filter((f) => f.endsWith(".js"));
    expect(entries.some((f) => fs.readFileSync(f, "utf8").includes("keel-peer"))).toBe(true);

    const unset = buildFixture(WEB_AND_API);
    expect(unset.status).toBe(0);
    expect(keelPeerTags(fs.readFileSync(path.join(unset.root, "dist", "web", "index.html"), "utf8"))).toHaveLength(0);

    const bad = buildFixture(WEB_AND_API, { KEEL_PEER_API: "nope" });
    expect(bad.status).not.toBe(0);
    const lines = bad.out.split("\n").filter((l) => l.includes("E1565"));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/E1565 /);
    expect(lines[0]).toContain("KEEL_PEER_API");
    expect(bad.out).not.toContain("nope");
  }, 300_000);

  test("With `allow: ['https://app.test']`: a preflight from that origin to an API route is 204 with the six headers; a POST from it runs the action and carries the two response headers; the same requests from `https://other.test` are 405 and 403; a preflight to a page is 405.", async () => {
    const app = await boot();
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("GET", "POST"), async (method) => {
        reset();
        const res = await app.fetch(preflight("/api/lists", ALLOWED, method));
        expect(res.status).toBe(204);
        expect(res.headers.get("access-control-allow-origin")).toBe(ALLOWED);
        const methods = tokens(res.headers.get("access-control-allow-methods"));
        expect(methods).toEqual(expect.arrayContaining(["get", "post"]));
        expect(methods).not.toContain("delete");
        expect(tokens(res.headers.get("access-control-allow-headers"))).toEqual([
          "accept",
          "authorization",
          "content-type",
          "x-keel",
        ]);
        expect(res.headers.get("access-control-allow-credentials")).toBe("true");
        expect(res.headers.get("access-control-max-age")).toBe("600");
        expect(tokens(res.headers.get("vary"))).toContain("origin");
        expect(count).toEqual({ guard: 0, loader: 0, action: 0 });
      }),
      { seed: SEED, numRuns: 4 },
    );

    reset();
    const written = await app.fetch(withHeaders(post("/api/lists", { note: "hi" }), { origin: ALLOWED }));
    expect(written.status).toBe(200);
    expect(count.action).toBe(1);
    expect(written.headers.get("access-control-allow-origin")).toBe(ALLOWED);
    expect(written.headers.get("access-control-allow-credentials")).toBe("true");
    expect(tokens(written.headers.get("vary"))).toContain("origin");

    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom("https://other.test", "http://app.test", "https://app.test.evil", "https://app.test:8443"),
        async (origin) => {
          reset();
          const pre = await app.fetch(preflight("/api/lists", origin));
          expect(pre.status).toBe(405);
          expect(pre.headers.get("access-control-allow-origin")).toBeNull();
          const w = await app.fetch(withHeaders(post("/api/lists", { note: "hi" }), { origin }));
          expect(w.status).toBe(403);
          expect(w.headers.get("access-control-allow-origin")).toBeNull();
          expect(count.action).toBe(0);
        },
      ),
      { seed: SEED, numRuns: 4 },
    );

    const onPage = await app.fetch(preflight("/", ALLOWED, "GET"));
    expect(onPage.status).toBe(405);
    expect(onPage.headers.get("access-control-allow-origin")).toBeNull();
  });

  test("`KEEL_ALLOW_ORIGINS=*` exits 1 with one E1560 naming the key.", async () => {
    const b = buildFixture(WEB_AND_API);
    expect(b.status).toBe(0);
    await fc.assert(
      fc.property(fc.constantFrom("*", "https://app.test/path", "https://ok.test,*"), (value) => {
        const r = spawnSync(process.execPath, [path.join(b.root, "dist", "api", "server.mjs")], {
          cwd: b.root,
          encoding: "utf8",
          env: deployEnv({ KEEL_SECRET: "s".repeat(32), KEEL_ALLOW_ORIGINS: value }),
        });
        expect(r.status).toBe(1);
        const lines = `${r.stdout}${r.stderr}`.split("\n").filter((l) => l.includes("E1560"));
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("KEEL_ALLOW_ORIGINS");
      }),
      { seed: SEED, numRuns: 3 },
    );
  }, 240_000);

  test("A request from an allowed origin with `sec-fetch-site: cross-site` logs W1567 once for that origin.", async () => {
    const lines: string[] = [];
    const second = "https://app2.test";
    const app = await boot({
      mode: "dev",
      allow: [ALLOWED, second],
      log: { format: "json", write: (l: string) => void lines.push(l) },
    });
    const w1567 = (): string[] =>
      lines.filter((l) => {
        try {
          const v: unknown = JSON.parse(l);
          return typeof v === "object" && v !== null && "kind" in v && v.kind === "diag" && l.includes("W1567");
        } catch {
          return false;
        }
      });
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 2, max: 4 }), async (n) => {
        for (let i = 0; i < n; i++) {
          const res = await app.fetch(
            withHeaders(new Request("http://localhost/api/lists"), { origin: ALLOWED, "sec-fetch-site": "cross-site" }),
          );
          await res.text();
        }
        expect(w1567().filter((l) => l.includes(ALLOWED))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 2 },
    );
    await (
      await app.fetch(
        withHeaders(new Request("http://localhost/api/lists"), { origin: second, "sec-fetch-site": "cross-site" }),
      )
    ).text();
    expect(w1567()).toHaveLength(2);
    expect(w1567().filter((l) => l.includes(second))).toHaveLength(1);
  });

  test("With `servedBy: 'api'`, `node dist/api/server.mjs` answers `GET /` and `GET /no/such/page` with the client `index.html`, an unmatched runtime GET with 404, and a client asset as `immutable`; `servedBy` naming a `client` deployable is E1566.", async () => {
    const b = buildFixture(
      `{ api: { modules: ["api"], adapter: "node" }, web: { modules: ["app"], adapter: "client", servedBy: "api" } }`,
    );
    expect(b.status).toBe(0);
    const index = fs.readFileSync(path.join(b.root, "dist", "web", "index.html"), "utf8");
    expect(fs.readFileSync(path.join(b.root, "dist", "api", "index.html"), "utf8")).toBe(index);
    const asset = fs.readdirSync(path.join(b.root, "dist", "api", "assets"))[0];
    if (asset === undefined) throw new Error("host has no copied assets");
    await withServer(b.root, "api", async (port) => {
      for (const p of ["/", "/no/such/page"]) {
        const doc = await send(port, "GET", p, { accept: "text/html" });
        expect(doc.status).toBe(200);
        expect(doc.body).toBe(index);
        expect(String(doc.headers["cache-control"])).toContain("no-cache");
        const head = await send(port, "HEAD", p, { accept: "text/html" });
        expect(head.status).toBe(200);
      }
      for (const accept of ["application/json", "text/event-stream"]) {
        expect((await send(port, "GET", "/no/such/page", { accept })).status).toBe(404);
      }
      const a = await send(port, "GET", `/assets/${asset}`);
      expect(a.status).toBe(200);
      expect(String(a.headers["cache-control"])).toContain("immutable");
    });

    const onClient = buildFixture(
      `{ api: { modules: ["api"], adapter: "node" }, web: { modules: ["app"], adapter: "client", servedBy: "web" } }`,
    );
    expect(onClient.status).not.toBe(0);
    expect(onClient.out).toContain("E1566");
  }, 300_000);

  test("E1566 `servedBy` on a deployable that is not `client`, naming an unknown or non-`node` deployable, or two `client` deployables naming one.", () => {
    const bad = [
      `{ api: { modules: ["api"], adapter: "node", servedBy: "api" }, web: { modules: ["app"], adapter: "client" } }`,
      `{ api: { modules: ["api"], adapter: "node" }, web: { modules: ["app"], adapter: "client", servedBy: "nowhere" } }`,
      `{ api: { modules: ["api"], adapter: "node" }, pre: { modules: ["app"], adapter: "static" }, web: { modules: [], adapter: "client", servedBy: "pre" } }`,
    ];
    for (const t of bad) {
      const b = buildFixture(t);
      expect(b.status, t).not.toBe(0);
      expect(b.out, t).toContain("E1566");
    }
  }, 300_000);

  test("A deployable with `host: 'api'` is one E1552 naming `host`; `topology()` throws E1552 for it.", () => {
    const leftover = `{ api: { modules: ["api"], adapter: "node" }, web: { modules: ["app"], adapter: "client", host: "api" } }`;
    const b = buildFixture(leftover);
    expect(b.status).not.toBe(0);
    expect(b.out.match(/E1552/g)?.length).toBe(1);
    expect(b.out).toContain("host");
    expect(fs.existsSync(path.join(b.root, "dist"))).toBe(false);
    const declared = {
      api: { modules: ["api"], adapter: "node" },
      web: { modules: ["app"], adapter: "client", host: "api" },
    };
    // Reflect.apply: the declaration is deliberately outside `topology`'s parameter type.
    expect(() => Reflect.apply(topology, undefined, [declared])).toThrow(/^E1552/);
  }, 300_000);

  test("A deployable key the Declaration omits is E1552 too: `topology()` with a key but `modules`, `adapter`, `servedBy`, `storage`, `shells`, `caller`, `origins` throws a message starting E1552.", () => {
    // Seed 1337 (SEED, fixtures.ts).
    const known = new Set(["modules", "adapter", "servedBy", "storage", "shells", "caller", "origins"]);
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,10}$/).filter((k) => !known.has(k)),
        fc.constantFrom("node", "static", "client"),
        (key, adapter) => {
          const web = { modules: ["app"], adapter, [key]: "api" };
          expect(() =>
            Reflect.apply(topology, undefined, [{ api: { modules: ["api"], adapter: "node" }, web }]),
          ).toThrow(/^E1552/);
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });

  test("W1567 an allowed origin that is cross-site to the server: the caller cookie cannot reach it; use one registrable domain or one origin.", async () => {
    const lines: string[] = [];
    const app = await boot({ mode: "dev", log: { format: "json", write: (l: string) => void lines.push(l) } });
    const res = await app.fetch(
      withHeaders(new Request("http://localhost/api/lists"), { origin: ALLOWED, "sec-fetch-site": "cross-site" }),
    );
    await res.text();
    const hits = lines.filter((l) => l.includes("W1567"));
    expect(hits).toHaveLength(1);
    expect(hits[0]).toMatch(/W1567/);
    expect(hits[0]).toContain('"diag"');
    const same = lines.length;
    await (
      await app.fetch(
        withHeaders(new Request("http://localhost/api/lists"), { origin: ALLOWED, "sec-fetch-site": "same-site" }),
      )
    ).text();
    expect(lines.slice(same).filter((l) => l.includes("W1567"))).toHaveLength(0);
  });
});
