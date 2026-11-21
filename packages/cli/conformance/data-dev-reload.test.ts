// Spec: k.data, clause 5 (k.data#5): "Under `keel dev`, editing and saving `modules/notes/mongoNotes.server.ts` twice: the next request to a loader calling its accessor answers with the edited code, and no E1602 is thrown or logged."
// Seed: 1337 (no generated inputs: a fixed process scenario). Spawns the real binary over a temp project with `vite` linked, as
// packages/cli/conformance/dev-uncaught.test.ts does; the port is one the OS just freed and the child's process group is killed.
// Waits are bounded retries with a fixed pause. ASSUMPTION: `keel dev` is `packages/cli/src/bin.ts dev --port N --format=json`.
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
const SLOW = 120_000;
const CAP = "modules/notes/mongoNotes.server.ts";

const capability = (title: string): string => `import { register } from "@keel/ctx";
const impl = () => ({ title: () => ${JSON.stringify(title)} });
export const mongoNotes = register("notes.mongo", { real: impl, shell: impl, sim: impl });
`;
const ROUTES = `import { loader, manifest } from "@keel/router";
import { contract } from "@keel/router/contract";
import { ok, s } from "@keel/schema";
import { mongoNotes } from "./mongoNotes.server.ts";
const Out = s.object({ title: s.string() });
const notes = contract("notes", { "notes.get": { method: "GET", path: "/api/notes/one", output: Out } });
const get = loader(notes, "notes.get", {}, (_args, ctx) => Promise.resolve(ok({ title: mongoNotes(ctx).title() })));
export const routes = manifest(notes, { "notes.get": { loader: get } });
`;

let fixture = "";
const write = (rel: string, content: string): void => {
  const file = join(fixture, rel);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
};
beforeAll(() => {
  fixture = realpathSync(mkdtempSync(join(tmpdir(), "keel-dev-reload-")));
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
    'import { topology } from "@keel/server";\nexport default topology({ web: { modules: ["notes"], adapter: "node" } });\n',
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
    "modules/notes/module.ts",
    'import { module } from "@keel/compiler";\nexport default module({ id: "notes", deps: [], capabilities: ["notes.mongo"], public: { exports: [] } });\n',
  );
  write("modules/notes/routes.ts", ROUTES);
  write(CAP, capability("v0"));
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

type Dev = { readonly port: number; readonly child: ChildProcess; readonly text: () => string };
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
  const onData = (d: Buffer): void => {
    buf += d.toString();
  };
  child.stdout?.on("data", onData);
  child.stderr?.on("data", onData);
  const dev: Dev = { port, child, text: () => buf };
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

/** The loader's `title` from `GET /api/notes/one`, or `undefined` while the server answers anything else. */
async function titleOf(dev: Dev): Promise<string | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${dev.port}/api/notes/one`, { headers: { accept: "application/json" } });
    if (res.status !== 200) return undefined;
    const body: unknown = await res.json();
    const results = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
    const entry = typeof results === "object" && results !== null ? Reflect.get(results, "notes.get") : undefined;
    const value = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
    const title = typeof value === "object" && value !== null ? Reflect.get(value, "title") : undefined;
    return typeof title === "string" ? title : undefined;
  } catch {
    return undefined;
  }
}
async function until(dev: Dev, want: string): Promise<boolean> {
  for (let i = 0; i < 800 && dev.child.exitCode === null; i++) {
    if (i > 0) await pause(50);
    if ((await titleOf(dev)) === want) return true;
  }
  return false;
}

describe("k.data Dev: editing an app file that calls `register` loads the server graph again whole: no E1602", () => {
  test(
    "editing and saving modules/notes/mongoNotes.server.ts twice: each next request answers with the edited code, and no E1602 is thrown or logged",
    async () => {
      const dev = await startDev();
      expect(await until(dev, "v0"), dev.text()).toBe(true);
      for (const title of ["v1", "v2"]) {
        write(CAP, capability(title));
        expect(await until(dev, title), dev.text()).toBe(true);
      }
      expect(dev.child.exitCode).toBeNull();
      expect(dev.text()).not.toContain("E1602");
    },
    SLOW,
  );

  test(
    "negative: with no edit the served code is the first one and no E1602 is logged",
    async () => {
      write(CAP, capability("v0"));
      const dev = await startDev();
      expect(await until(dev, "v0"), dev.text()).toBe(true);
      expect(dev.text()).not.toContain("E1602");
    },
    SLOW,
  );
});
