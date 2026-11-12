// Spec: k.topology Conformance, "`keel dev` answers a `client` page and a path of each `node` deployable from one process on one origin."
// Seed 1337 (no generated input: one fixture, one spawn). Spawns the real binary over a temp project with `@keel/*` and `vite`
// linked, `keel dev --port p` with `p` from a closed listener on port 0, as dev-port-0091.test.ts does. The wait is a bounded retry
// of a socket connection (no timers). Only the child this test started is signalled (its process group), in a `finally`.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, expect, test } from "vitest";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SLOW = 120_000;

let fixture = "";
const write = (rel: string, content: string): void => {
  const file = join(fixture, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
const manifestSrc = (id: string): string =>
  `import { module } from "@keel/compiler";\nexport default module({ id: "${id}", deps: [], capabilities: [], public: { exports: [], routes: [] } });\n`;
const routesSrc = (id: string, path: string): string =>
  `import { manifest } from "@keel/router";\nconst Page = () => null;\nexport const routes = manifest({ "${id}.home": { path: "${path}", component: Page } });\n`;

beforeAll(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "keel-dev-origin-")));
  mkdirSync(join(fixture, "node_modules", "@keel"), { recursive: true });
  for (const p of readdirSync(join(REPO, "packages"))) {
    symlinkSync(join(REPO, "packages", p), join(fixture, "node_modules", "@keel", p));
  }
  symlinkSync(join(REPO, "node_modules", "vite"), join(fixture, "node_modules", "vite"));
  mkdirSync(join(fixture, "node_modules", ".bin"), { recursive: true });
  symlinkSync("../vite/bin/vite.js", join(fixture, "node_modules", ".bin", "vite"));
  write("package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({\n  c: { modules: ["web"], adapter: "client" },\n  x: { modules: ["ax"], adapter: "node" },\n  y: { modules: ["by"], adapter: "node" },\n});\n',
  );
  write(
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    "index.html",
    '<!doctype html>\n<html lang="en">\n  <head>\n    <meta charset="utf-8" />\n    <title>fx</title>\n  </head>\n  <body>\n    <div id="app"></div>\n    <script type="module" src="/@keel/entry.ts"></script>\n  </body>\n</html>\n',
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
  );
  for (const [id, path] of [
    ["web", "/"],
    ["ax", "/ax"],
    ["by", "/by"],
  ] as const) {
    write(`modules/${id}/module.ts`, manifestSrc(id));
    write(`modules/${id}/routes.ts`, routesSrc(id, path));
  }
});
afterAll(() => rmSync(fixture, { recursive: true, force: true }));

const childEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k === "PORT") continue;
    env[k] = v;
  }
  return env;
};

type Proc = { child: ChildProcess; out: () => string; exited: Promise<number | null> };
function startDev(args: string[]): Proc {
  const child = spawn(process.execPath, [BIN, "dev", ...args, "--format=json"], {
    cwd: fixture,
    env: childEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let buf = "";
  child.stdout?.on("data", (d: Buffer) => {
    buf += d.toString();
  });
  child.stderr?.on("data", (d: Buffer) => {
    buf += d.toString();
  });
  const exited = new Promise<number | null>((res) => child.on("close", (code) => res(code)));
  return { child, out: () => buf, exited };
}
function stop(p: Proc): Promise<number | null> {
  const pid = p.child.pid;
  if (pid !== undefined && p.child.exitCode === null) {
    try {
      process.kill(-pid, "SIGTERM");
    } catch {
      // already gone
    }
  }
  return p.exited;
}

const freePort = (): Promise<number> =>
  new Promise((resolvePort, reject) => {
    const srv = net.createServer();
    srv.listen(0, () => {
      const addr = srv.address();
      srv.close(() =>
        typeof addr === "object" && addr !== null ? resolvePort(addr.port) : reject(new Error("no port")),
      );
    });
  });

/** Whether something accepts a TCP connection on `port` (a socket's errors arrive as events, never as throws). */
const accepts = (port: number): Promise<boolean> =>
  new Promise((res) => {
    const sock = net.connect({ port, host: "localhost" });
    sock.once("connect", () => {
      sock.destroy();
      res(true);
    });
    sock.once("error", () => res(false));
  });

/** Bounded retry until the port accepts a connection and answers any HTTP status, or the process exits. */
async function served(p: Proc, port: number): Promise<boolean> {
  let done = false;
  void p.exited.then(() => {
    done = true;
  });
  for (let i = 0; i < 4000 && !done; i++) {
    if (!(await accepts(port))) continue;
    const ok = await fetch(`http://localhost:${port}/`).then(
      () => true,
      () => false,
    );
    if (ok) return true;
  }
  return false;
}

/** TCP ports the process group `pgid` listens on (`lsof -g`; none listening: no output). */
function listening(pgid: number): number[] {
  const r = spawnSync("lsof", ["-nP", "-a", "-g", String(pgid), "-iTCP", "-sTCP:LISTEN", "-Fn"], { encoding: "utf8" });
  const ports = new Set<number>();
  for (const line of r.stdout.split("\n")) {
    const m = /^n.*:(\d+)$/.exec(line);
    if (m?.[1] !== undefined) ports.add(Number(m[1]));
  }
  return [...ports].sort((a, b) => a - b);
}

test(
  "`keel dev` answers a `client` page and a path of each `node` deployable from one process on one origin.",
  async () => {
    const port = await freePort();
    const p = startDev(["--port", String(port)]);
    try {
      expect(await served(p, port), p.out()).toBe(true);
      const origin = `http://localhost:${port}`;
      const html = { accept: "text/html" };

      const page = await fetch(`${origin}/`, { headers: html });
      expect(page.status).toBe(200);
      expect(await page.text()).toContain("/@keel/entry.ts");

      for (const path of ["/ax", "/by"]) {
        const res = await fetch(`${origin}${path}`, { headers: html });
        expect(res.status, path).toBe(200);
        expect(await res.text(), path).toContain("<");
      }

      const pid = p.child.pid;
      expect(pid).toBeDefined();
      expect(listening(pid ?? 0)).toEqual([port]);
    } finally {
      await stop(p);
    }
  },
  SLOW,
);
