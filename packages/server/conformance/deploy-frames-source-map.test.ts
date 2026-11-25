// Spec: k.deploy, clause "A loader throwing in `modules/a/a.server.ts` of a `keel build` fixture logs, from `node dist/<name>/server.mjs` in json, `frames` starting `modules/a/a.server.ts:`; `server.mjs.map` has no `sourcesContent`, and no response to `GET /server.mjs.map` contains its `mappings`."
// Seed: 1337.
// ASSUMED shape (k.server Log): `frames` is an array of strings in json mode; stdout carries one json record per line.
// Pattern of topology-server-mjs.test.ts: symlinked workspace packages, the real CLI builds once, the listening wait is a
// bounded retry of `fetch` (no timers), the port is one the OS just freed; the child is stopped in a `finally`.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, describe, expect, test } from "vitest";
import { REPO, deployEnv } from "./topology-build-fixture.ts";

const COUNTER = `import { signal } from "@keel/reactive";
import { Box, Button, Text } from "@keel/ui";
export default function Counter() {
  const n = signal(0);
  return <Box><Button id="c.inc" onClick={() => n.set(n.get() + 1)}>+</Button><Text id="c.out">{n.get()}</Text></Box>
}
`;
const CONTRACT_FILE = `import { contract } from "@keel/router/contract";
export const a = contract("a", {
  "a.home": { path: "/" },
  "a.show": { path: "/a" },
});
`;
const SERVER_FILE = `import { loader } from "@keel/router";
import { s } from "@keel/schema";
import { a as aContract } from "./a.contract.ts";

export const a = loader(aContract, "a.show", { output: s.object({}) }, () => Promise.reject(new Error("boom")));
`;
const ROUTES = `import { manifest } from "@keel/router";
import Counter from "./Counter.tsx";
import { a } from "./a.server.ts";
import { a as aContract } from "./a.contract.ts";
export const routes = manifest(aContract, {
  "a.home": { component: Counter },
  "a.show": { loader: a, component: Counter },
});
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

/** A `keel build` fixture: one `node` deployable `web` serving module `a`, whose loader in `a.server.ts` throws. */
function buildFixture(): string {
  const fixture = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), "keel-frames-map-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server", "ui"]) {
    link(path.join(REPO, "packages", p), path.join(fixture, "node_modules", "@keel", p));
  }
  link(path.join(REPO, "node_modules", "vite"), path.join(fixture, "node_modules", "vite"));
  link("../vite/bin/vite.js", path.join(fixture, "node_modules", ".bin", "vite"));
  write(fixture, "package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    fixture,
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["a"], adapter: "node" } });\n',
  );
  write(
    fixture,
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    fixture,
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
  write(fixture, "modules/a/Counter.tsx", COUNTER);
  write(fixture, "modules/a/a.contract.ts", CONTRACT_FILE);
  write(fixture, "modules/a/a.server.ts", SERVER_FILE);
  write(
    fixture,
    "modules/a/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "a", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(fixture, "modules/a/routes.ts", ROUTES);
  const r = spawnSync(process.execPath, [path.join(REPO, "packages", "cli", "src", "bin.ts"), "build"], {
    cwd: fixture,
    encoding: "utf8",
    env: { ...process.env, KEEL_AGENT: "1" },
  });
  if (r.status !== 0) throw new Error(`keel build failed (status ${String(r.status)})\n${r.stdout}\n${r.stderr}`);
  return fixture;
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

let fixture = "";
beforeAll(() => {
  fixture = buildFixture();
}, 90_000);
afterAll(() => fs.rmSync(fixture, { recursive: true, force: true }));

interface Served {
  readonly port: number;
  readonly out: () => string;
}

/** Run `server.mjs`, hand `use` its port and stdout, and always stop the child (and await its exit). */
async function serving<T>(use: (s: Served) => Promise<T>): Promise<T> {
  const entry = path.join(fixture, "dist", "web", "server.mjs");
  expect(fs.existsSync(entry)).toBe(true);
  const port = await freePort();
  const child = spawn(process.execPath, [entry], {
    cwd: fixture,
    env: deployEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), KEEL_FORMAT: "json" }),
    stdio: ["ignore", "pipe", "ignore"],
  });
  let stdout = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk: string) => {
    stdout += chunk;
  });
  const exited = new Promise<void>((resolve) => child.once("exit", () => resolve()));
  try {
    let status = 0;
    for (let i = 0; i < 4000 && status === 0; i++) {
      status = await fetch(`http://127.0.0.1:${port}/`).then(
        (r) => r.status,
        () => 0,
      );
    }
    expect(status).toBe(200);
    return await use({ port, out: () => stdout });
  } finally {
    child.kill("SIGTERM");
    await exited;
  }
}

const records = (text: string): unknown[] =>
  text
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .map((l): unknown => JSON.parse(l));
const isDiag = (r: unknown): boolean => typeof r === "object" && r !== null && Reflect.get(r, "kind") === "diag";

describe("k.deploy: frames through server.mjs.map", () => {
  test("a loader throwing in `modules/a/a.server.ts` of a `keel build` fixture logs, from `node dist/<name>/server.mjs` in json, `frames` starting `modules/a/a.server.ts:`", async () => {
    await serving(async ({ port, out }) => {
      const res = await fetch(`http://127.0.0.1:${port}/a`);
      expect(res.status).toBe(500);
      const diag = records(out()).find(isDiag);
      expect(diag).toBeDefined();
      const frames: unknown = Reflect.get(Object(diag), "frames");
      expect(Array.isArray(frames)).toBe(true);
      const list: unknown[] = Array.isArray(frames) ? frames : [];
      expect(list.length).toBeGreaterThan(0);
      expect(list.length).toBeLessThanOrEqual(5);
      expect(String(list[0])).toMatch(/^modules\/a\/a\.server\.ts:\d+:\d+$/);
      for (const f of list) {
        expect(String(f)).not.toMatch(/server\.mjs|^packages\/|node_modules\/|^\//);
        expect(String(f)).toMatch(/:\d+:\d+$/);
      }
    });
  }, 120_000);

  test("`server.mjs.map` has no `sourcesContent`", () => {
    const map: unknown = JSON.parse(fs.readFileSync(path.join(fixture, "dist", "web", "server.mjs.map"), "utf8"));
    expect(typeof map).toBe("object");
    expect(Reflect.has(Object(map), "sourcesContent")).toBe(false);
    const sources: unknown = Reflect.get(Object(map), "sources");
    expect(Array.isArray(sources)).toBe(true);
    for (const src of Array.isArray(sources) ? sources : []) {
      expect(String(src)).not.toMatch(/^\/|^[A-Za-z]:/);
    }
    expect(sources).toContain("modules/a/a.server.ts");
  });

  test("no response to `GET /server.mjs.map` contains its `mappings`", async () => {
    const map: unknown = JSON.parse(fs.readFileSync(path.join(fixture, "dist", "web", "server.mjs.map"), "utf8"));
    const mappings: unknown = Reflect.get(Object(map), "mappings");
    expect(typeof mappings === "string" && mappings.length > 0).toBe(true);
    const needle = String(mappings).slice(0, 64);
    await serving(async ({ port }) => {
      await fc.assert(
        fc.asyncProperty(
          fc.constantFrom(
            "/server.mjs.map",
            "/assets/server.mjs.map",
            "//server.mjs.map",
            "/server.mjs.map?x=1",
            "/%73erver.mjs.map",
          ),
          fc.constantFrom("GET", "HEAD"),
          async (route, method) => {
            const res = await fetch(`http://127.0.0.1:${port}${route}`, { method });
            const body = await res.text();
            expect(body).not.toContain(needle);
          },
        ),
        { seed: 1337, numRuns: 10 },
      );
    });
  }, 120_000);
});
