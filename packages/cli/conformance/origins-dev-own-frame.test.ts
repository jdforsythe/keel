// rfc:0160 conformance: a `keel dev` document framing `http://localhost:<its port>` has a `frame-src` without it.
// Spec: k.origins, Frame "A `frame` origin of the app's own is E1590 in `keel build` (a `KEEL_PEER_<NAME>`, `KEEL_ORIGIN`) and `createApp` (`origin`, a URL peer); a document drops its own from `frame-src` (dev: one E1590 logged)."
// Seed 1337 (no generated input: one fixture, one spawn). Spawns the real binary over a temp project with `@keel/*` and `vite` linked, `keel dev --port p`
// with `p` from a closed listener on port 0, as topology-keel-dev-one-origin.test.ts does. The wait is a retry, with a fixed pause, of a socket connection, bounded by a count of pauses.
// Only the child this test started is signalled (its process group), in a `finally`; every child is ended in `afterEach`.
// ASSUMPTION: the dev document carries its policy in `Content-Security-Policy-Report-Only` (k.security, dev); the E1590 log line is a `diag` record on the process's output.
import { type ChildProcess, spawn } from "node:child_process";
import { mkdirSync, mkdtempSync, readdirSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import http from "node:http";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, describe, expect, test } from "vitest";

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

function setup(frames: string[]): void {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "keel-dev-frame-")));
  mkdirSync(join(fixture, "node_modules", "@keel"), { recursive: true });
  for (const p of readdirSync(join(REPO, "packages"))) {
    symlinkSync(join(REPO, "packages", p), join(fixture, "node_modules", "@keel", p));
  }
  symlinkSync(join(REPO, "node_modules", "vite"), join(fixture, "node_modules", "vite"));
  mkdirSync(join(fixture, "node_modules", ".bin"), { recursive: true });
  symlinkSync("../vite/bin/vite.js", join(fixture, "node_modules", ".bin", "vite"));
  write("package.json", `${JSON.stringify({ name: "fx", private: true, type: "module" })}\n`);
  const frame = frames.map((o) => `'${o}': 'r'`).join(", ");
  write(
    "topology.ts",
    `import { topology } from "@keel/server";\nexport default topology({\n  c: { modules: ["web"], adapter: "client" },\n  x: { modules: ["ax"], adapter: "node", origins: { frame: { ${frame} } } },\n});\n`,
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
  ] as const) {
    write(`modules/${id}/module.ts`, manifestSrc(id));
    write(`modules/${id}/routes.ts`, routesSrc(id, path));
  }
}
afterAll(() => {
  if (fixture !== "") rmSync(fixture, { recursive: true, force: true });
});

const childEnv = (): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k === "NODE_OPTIONS" || k === "TEST" || k === "PORT") continue;
    env[k] = v;
  }
  return env;
};

type Proc = { child: ChildProcess; out: () => string; exited: Promise<number | null> };
const started = new Set<Proc>();
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
function signal(p: Proc, s: NodeJS.Signals): void {
  const pid = p.child.pid;
  if (pid === undefined || p.child.exitCode !== null || p.child.signalCode !== null) return;
  try {
    process.kill(-pid, s);
  } catch {
    // the group is gone
  }
}
async function stop(p: Proc): Promise<void> {
  started.delete(p);
  signal(p, "SIGTERM");
  let timer: NodeJS.Timeout | undefined;
  const late = new Promise<"late">((r) => {
    timer = setTimeout(() => r("late"), 10_000);
  });
  const first = await Promise.race([p.exited, late]);
  clearTimeout(timer);
  if (first === "late") signal(p, "SIGKILL");
  await p.exited;
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

type Reply = { readonly status: number; readonly policy: string };
const get = (port: number, path: string): Promise<Reply | null> =>
  new Promise((done) => {
    const req = http.get(
      { host: "localhost", port, path, headers: { accept: "text/html" }, agent: false, timeout: 10_000 },
      (res) => {
        res.resume();
        const policy = String(res.headers["content-security-policy-report-only"] ?? "");
        res.on("end", () => done({ status: res.statusCode ?? 0, policy }));
        res.on("error", () => done(null));
        res.on("aborted", () => done(null));
      },
    );
    req.on("timeout", () => req.destroy());
    req.on("error", () => done(null));
  });

async function served(p: Proc, port: number): Promise<boolean> {
  let done = false;
  void p.exited.then(() => {
    done = true;
  });
  for (let i = 0; i < 800 && !done; i++) {
    if (i > 0) await pause(50);
    if ((await get(port, "/")) !== null) return true;
  }
  return false;
}

describe("rfc:0160 conformance: keel dev and an own-origin frame", () => {
  test(
    "rfc:0160 conformance: a `keel dev` document framing `http://localhost:<its port>` has a `frame-src` without it, and one E1590 is logged",
    async () => {
      const port = await freePort();
      setup([`http://localhost:${port}`, "https://v.example"]);
      const p = startDev(["--port", String(port)]);
      try {
        expect(await served(p, port), p.out()).toBe(true);
        const res = await get(port, "/ax");
        expect(res?.status).toBe(200);
        const frame = (res?.policy ?? "")
          .split(";")
          .map((d) => d.trim())
          .find((d) => d.startsWith("frame-src"));
        expect(frame).toBe("frame-src https://v.example");
        expect(res?.policy).not.toContain(`localhost:${port}`);
        const logged = p
          .out()
          .split("\n")
          .filter((l) => l.includes("E1590"));
        expect(logged.length).toBe(1);
      } finally {
        await stop(p);
      }
    },
    SLOW,
  );
});
