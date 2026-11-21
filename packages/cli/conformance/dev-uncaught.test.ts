// Spec: k.leave, Process "The production entry (`server.mjs`, k.deploy) and `keel dev` handle every `uncaughtException` and `unhandledRejection`; `createApp` adds no process listener, so a process that embeds it chooses its own. Each writes one `diag` record E1577 `uncaught <exception|rejection> in work of route <id>`, the route id of the request whose async context the failing work ran in, else `-`, with the error's `frames` (k.deploy) and no thrown text. In production the first one then stops the server listening, lets requests in flight finish for at most 10,000 ms, calls `close()` (k.topology) and the storage driver's `close()`, and exits 1, so a supervisor restarts it; a later one during that drain writes its record and changes nothing else. `keel dev` appends the thrown text, scrubbed and cut (k.serverlog), and keeps serving."
// Spec: k.leave, Conformance "Under `keel dev` the same throw writes one E1577 holding the thrown text, and a later GET answers 200."
// Seed: 1337 (no generated inputs: every case is a fixed process scenario). Spawns the real binary over a temp project with
// `vite` linked, as dev-port-0091.test.ts does; the port is one the OS just freed and every child's process group is killed.
// The wait for the server is a bounded retry with a fixed pause, as in dev-port-0091.test.ts.
// The clause that names the thrown text and the planted `.pii()` value is the dev half of the Process paragraph.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");
const SLOW = 90_000;
const THROWN = "planted-thrown-text";
const EMAIL = "alice@planted.test";
/** The fixture's own timer, spelled so the fixture's source is data here. */
const TIMER = ["set", "Timeout"].join("");

const ROUTES = `import { action, loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
const Data = s.object({ title: s.string() });
const Save = s.object({ email: s.string().pii("contact") });
const Home = () => null;
const answer = (title) => Promise.resolve(ok({ title }));
const app = contract("app", {
  "app.home": { path: "/" },
  "app.late": { path: "/late" },
  "app.save": { path: "/save" },
});

const late = loader(app, "app.late", { output: Data }, () => {
  ${TIMER}(() => { throw new Error(${JSON.stringify(THROWN)}); }, 30);
  return answer("late");
});
const quiet = loader(app, "app.home", { output: Data }, () => answer("quiet"));
const save = action(app, "app.save", { input: Save }, (input) => {
  ${TIMER}(() => { throw new Error("failed for " + input.email); }, 30);
  return Promise.resolve(ok(null));
});
export const routes = manifest(app, {
  "app.home": { component: Home, loader: quiet },
  "app.late": { component: Home, loader: late },
  "app.save": { component: Home, POST: save },
});
`;

let fixture = "";
const write = (rel: string, content: string): void => {
  const file = join(fixture, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
beforeAll(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "keel-dev-uncaught-")));
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
  write("modules/app/routes.ts", ROUTES);
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

type Dev = {
  readonly port: number;
  readonly child: ChildProcess;
  readonly text: () => string;
  readonly e1577: () => string[];
  readonly until: (pred: () => boolean) => Promise<boolean>;
};
const started: Dev[] = [];

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

async function startDev(): Promise<Dev> {
  const port = await freePort();
  const child = spawn(process.execPath, [BIN, "dev", "--port", String(port), "--format=json"], {
    cwd: fixture,
    env: childEnv(),
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  let buf = "";
  const waiters: (() => void)[] = [];
  const onData = (d: Buffer): void => {
    buf += d.toString();
    for (const w of [...waiters]) w();
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  const exited = new Promise<void>((res) => child.on("close", () => res()));
  const dev: Dev = {
    port,
    child,
    text: () => buf,
    e1577: () => buf.split("\n").filter((l) => l.includes("E1577")),
    until: (pred) =>
      new Promise<boolean>((resolve) => {
        if (pred()) return resolve(true);
        waiters.push(() => {
          if (pred()) resolve(true);
        });
        void exited.then(() => resolve(pred()));
      }),
  };
  started.push(dev);
  return dev;
}

afterEach(() => {
  for (const dev of started.splice(0)) {
    const pid = dev.child.pid;
    if (pid === undefined || dev.child.exitCode !== null || dev.child.signalCode !== null) continue;
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // the group is gone
    }
  }
});

const statusOf = (port: number, pathname: string, init?: RequestInit): Promise<number> =>
  fetch(`http://127.0.0.1:${port}${pathname}`, init).then(
    (r) => r.status,
    () => 0,
  );

async function served(dev: Dev): Promise<boolean> {
  for (let i = 0; i < 800 && dev.child.exitCode === null; i++) {
    if (i > 0) await pause(50);
    if ((await statusOf(dev.port, "/")) === 200) return true;
  }
  return false;
}

describe("k.leave Process: keel dev writes one E1577 holding the thrown text, scrubbed, and keeps serving", () => {
  test(
    "`/late` answers 200 and throws 30 ms later: one E1577 record holding the thrown text, and a later GET answers 200",
    async () => {
      const dev = await startDev();
      expect(await served(dev), dev.text()).toBe(true);
      expect(await statusOf(dev.port, "/late")).toBe(200);
      expect(await dev.until(() => dev.e1577().length > 0)).toBe(true);
      expect(await statusOf(dev.port, "/")).toBe(200);
      expect(dev.child.exitCode).toBeNull();
      const lines = dev.e1577();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("uncaught exception in work of route app.late");
      expect(lines[0]).toContain(THROWN);
    },
    SLOW,
  );

  test(
    "an action's late throw holding a planted `.pii()` input value is written with `[pii]` in its place, and a later GET answers 200",
    async () => {
      const dev = await startDev();
      expect(await served(dev), dev.text()).toBe(true);
      const body = new FormData();
      body.set("email", EMAIL);
      const status = await statusOf(dev.port, "/save", {
        method: "POST",
        body,
        headers: { accept: "application/json", "x-keel": "1" },
      });
      expect(status).toBe(200);
      expect(await dev.until(() => dev.e1577().length > 0)).toBe(true);
      expect(await statusOf(dev.port, "/")).toBe(200);
      const lines = dev.e1577();
      expect(lines).toHaveLength(1);
      expect(lines[0]).toContain("failed for [pii]");
      expect(dev.text()).not.toContain(EMAIL);
    },
    SLOW,
  );

  test(
    "negative: with no throw, dev writes no E1577 and keeps serving",
    async () => {
      const dev = await startDev();
      expect(await served(dev), dev.text()).toBe(true);
      expect(await statusOf(dev.port, "/")).toBe(200);
      expect(dev.e1577()).toEqual([]);
    },
    SLOW,
  );
});
