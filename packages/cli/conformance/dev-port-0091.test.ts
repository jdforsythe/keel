// Spec: k.cli, clause "`keel dev --port <p>`, or `server.port: <p>` in the Vite config, serves on `p`; with `p` in use it prints one E1560 line and exits 1." (rfc:0091)
// Spec: k.cli Commands "`dev [--port N]` | dev server and log stream (default Vite's `server.port` or 5173; in use: E1560)"; Rules E1052 "flag value invalid for the input schema".
// Seed 1337. Spawns the real binary over a temp project with `vite` linked. The wait for the server is a retry, with a fixed pause, of
// an `http.get`, bounded by a count of pauses. Ports come from a listener on port 0 that is closed first; a busy port is held by the
// test's own listener. Only processes the test started are signalled (the child's process group); every child is ended in `afterEach`.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { SEED, keel } from "./fixtures.ts";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SLOW = 120_000;

let fixture = "";
const write = (rel: string, content: string): void => {
  const file = join(fixture, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
beforeAll(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "keel-dev-port-")));
  for (const p of ["compiler", "ctx", "reactive", "router", "runtime-dom", "schema", "store", "server"]) {
    mkdirSync(join(fixture, "node_modules", "@keel"), { recursive: true });
    symlinkSync(join(REPO, "packages", p), join(fixture, "node_modules", "@keel", p));
  }
  symlinkSync(join(REPO, "node_modules", "vite"), join(fixture, "node_modules", "vite"));
  mkdirSync(join(fixture, "node_modules", ".bin"), { recursive: true });
  symlinkSync("../vite/bin/vite.js", join(fixture, "node_modules", ".bin", "vite"));
  write("package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  write(
    "topology.ts",
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["app"], adapter: "node" } });\n',
  );
  write(
    "vite.config.ts",
    'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\nexport default defineConfig({ plugins: [keel()] });\n',
  );
  write(
    "tsconfig.json",
    JSON.stringify({
      compilerOptions: { jsx: "react-jsx", jsxImportSource: "@keel/runtime-dom", module: "esnext", target: "es2022" },
    }),
  );
  write(
    "modules/app/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "app", deps: [], capabilities: [], public: { exports: [] } });\n',
  );
  write(
    "modules/app/routes.ts",
    'import { manifest } from "@keel/router";\nimport { app } from "./app.contract.ts";\nconst Home = () => null;\nexport const routes = manifest(app, { "app.home": { component: Home } });\n',
  );
  write(
    "modules/app/app.contract.ts",
    'import { contract } from "@keel/router/contract";\nexport const app = contract("app", { "app.home": { path: "/" } });\n',
  );
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
  const proc: Proc = { child, out: () => buf, exited };
  started.add(proc);
  return proc;
}
const started = new Set<Proc>();

/** Sends `s` to `p`'s process group unless the child has already exited. */
function signal(p: Proc, s: NodeJS.Signals): void {
  const pid = p.child.pid;
  if (pid === undefined || p.child.exitCode !== null || p.child.signalCode !== null) return;
  try {
    process.kill(-pid, s);
  } catch {
    // the group is gone
  }
}

/** Ends `p`'s process group: SIGTERM, then SIGKILL if it has not closed 10 s later; resolves with its exit code. */
async function stop(p: Proc): Promise<number | null> {
  started.delete(p);
  signal(p, "SIGTERM");
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<"late">((r) => {
    timer = setTimeout(() => r("late"), 10_000);
  });
  const first = await Promise.race([p.exited, late]);
  clearTimeout(timer);
  if (first === "late") signal(p, "SIGKILL");
  return p.exited;
}

afterEach(async () => {
  await Promise.all([...started].map(stop));
});
process.once("exit", () => {
  for (const p of started) signal(p, "SIGKILL");
});

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

type Reply = { readonly status: number; readonly body: string };
/**
 * One GET to `localhost:port` over its own connection (no keep-alive): the status and the whole body, or null on any
 * socket or response error or after 10 s idle. The response is always read to its end, or destroyed.
 */
const get = (port: number, path: string, headers: Record<string, string> = {}): Promise<Reply | null> =>
  new Promise((done) => {
    const req = http.get({ host: "localhost", port, path, headers, agent: false, timeout: 10_000 }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => done({ status: res.statusCode ?? 0, body: Buffer.concat(chunks).toString("utf8") }));
      res.on("error", () => done(null));
      res.on("aborted", () => done(null));
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => done(null));
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

/**
 * Retry, with a fixed pause between attempts, until the port accepts a connection and answers any HTTP status, or the
 * process exits. 800 pauses of 50 ms bound the wait at about 40 s however fast a refused connect returns.
 */
async function served(p: Proc, port: number): Promise<boolean> {
  let done = false;
  void p.exited.then(() => {
    done = true;
  });
  for (let i = 0; i < 800 && !done; i++) {
    if (i > 0) await pause(50);
    if (!(await accepts(port))) continue;
    const ok = (await get(port, "/")) !== null;
    if (ok) return true;
  }
  return false;
}

const VITE_CONFIG = write_default();
function write_default(): string {
  return 'import keel from "@keel/compiler/vite";\nimport { defineConfig } from "vite";\n';
}
/** Rewrites the fixture's `vite.config.ts` with `server.port` set to `port`, or restores it when undefined. */
const setConfigPort = (port: number | undefined): void => {
  const server = port === undefined ? "" : `server: { port: ${port} }, `;
  write("vite.config.ts", `${VITE_CONFIG}export default defineConfig({ ${server}plugins: [keel()] });\n`);
};

/** Every `localhost:<port>` or `127.0.0.1:<port>` the output names is `busy`: the server did not move to another port. */
const expectNoMove = (text: string, busy: number): void => {
  for (const m of text.matchAll(/(?:localhost|127\.0\.0\.1|\[::1\]):(\d+)/g)) expect(Number(m[1])).toBe(busy);
};

const e1560 = (text: string): string[] => text.split("\n").filter((l) => l.includes("E1560"));

describe("k.cli keel dev --port (rfc:0091)", () => {
  test(
    "`keel dev --port <p>` serves on `p`",
    async () => {
      for (let i = 0; i < 2; i++) {
        const port = await freePort();
        const p = startDev(["--port", String(port)]);
        try {
          expect(await served(p, port)).toBe(true);
        } finally {
          await stop(p);
        }
      }
    },
    SLOW,
  );

  test(
    "with `p` in use it prints one E1560 line and exits 1, and does not move to another port",
    async () => {
      const holder = net.createServer((s) => s.destroy());
      await new Promise<void>((r) => holder.listen(0, r));
      const addr = holder.address();
      const busy = typeof addr === "object" && addr !== null ? addr.port : -1;
      try {
        expect(busy).toBeGreaterThan(0);
        const p = startDev(["--port", String(busy)]);
        const code = await p.exited;
        expect(code).toBe(1);
        const lines = e1560(p.out());
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(String(busy));
        // no move: the process has exited and names no port but `busy` (no probe of a neighbouring port: another process may hold it)
        expectNoMove(p.out(), busy);
      } finally {
        await new Promise<void>((r) => holder.close(() => r()));
      }
    },
    SLOW,
  );

  test(
    "`server.port: <p>` in the Vite config serves on `p`",
    async () => {
      const port = await freePort();
      setConfigPort(port);
      const p = startDev([]);
      try {
        expect(await served(p, port)).toBe(true);
      } finally {
        await stop(p);
        setConfigPort(undefined);
      }
    },
    SLOW,
  );

  test(
    "with the config's `p` in use it prints one E1560 line and exits 1, and does not move to another port",
    async () => {
      const holder = net.createServer((s) => s.destroy());
      await new Promise<void>((r) => holder.listen(0, r));
      const addr = holder.address();
      const busy = typeof addr === "object" && addr !== null ? addr.port : -1;
      setConfigPort(busy);
      const p = startDev([]);
      try {
        expect(busy).toBeGreaterThan(0);
        const code = await p.exited;
        expect(code).toBe(1);
        const lines = e1560(p.out());
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain(String(busy));
        expectNoMove(p.out(), busy);
      } finally {
        await stop(p);
        setConfigPort(undefined);
        await new Promise<void>((r) => holder.close(() => r()));
      }
    },
    SLOW,
  );

  test(
    "the default port is 5173: `keel dev` with no flag serves on 5173, or prints one E1560 line naming 5173 and exits 1 when it is in use",
    async () => {
      const probe = net.createServer();
      const free = await new Promise<boolean>((r) => {
        probe.once("error", () => r(false));
        probe.listen(5173, () => r(true));
      });
      if (free) await new Promise<void>((r) => probe.close(() => r()));
      const p = startDev([]);
      try {
        if (free) {
          expect(await served(p, 5173)).toBe(true);
        } else {
          expect(await p.exited).toBe(1);
          const lines = e1560(p.out());
          expect(lines).toHaveLength(1);
          expect(lines[0]).toContain("5173");
        }
      } finally {
        await stop(p);
      }
    },
    SLOW,
  );

  test("an invalid `--port` value is E1052", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(
          fc.constantFrom("0", "-1", "65536", "1.5", "abc", ""),
          fc.integer({ min: 65536, max: 10_000_000 }).map(String),
          fc.integer({ min: -10_000, max: -1 }).map(String),
          fc.stringMatching(/^[a-z]{1,8}$/),
        ),
        async (v) => {
          const r = await keel(["dev", `--port=${v}`]);
          expect(r.code).toBe(2);
          expect(r.stdout + r.stderr).toContain("E1052");
          expect(r.stdout + r.stderr).not.toContain("E1560");
        },
      ),
      { seed: SEED, numRuns: 25 },
    );
  });
});
