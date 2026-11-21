// Fixtures for the RFC 0175 app-data conformance files (not a test file). Seed 1337 for every property.
// Project: `clientTree()` of boundary-support.ts with `topology.ts` replaced: `api` (node) serves modules `a` and `m`, `web` (client) serves `w`.
// Module `m` holds `migrations/0001-x.sql` and one API loader `m.dirs` (GET /api/m/dirs) answering the values of `KEEL_APP_DIR` and `KEEL_DEV_DIR`
// (empty string when unset). Module `w` of the client deployable holds a `migrations/0001-w.sql` too.
// Assumption: a JSON GET of an API entry answers `{ results: { "<id>": { value } } }`, as data-dev-reload.test.ts reads it.
import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import { join } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { type Tree, childEnv, clientTree, manifestSrc } from "./boundary-support.ts";

export const MIGRATION_BYTES = "create table m_notes (id int primary key);\n-- bytes é 中\r\n\ttrailing\n";
const BIN = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

export function appDataTree(): Tree {
  return {
    ...clientTree(),
    "topology.ts":
      "import { topology } from '@keel/server'\nexport default topology({ api: { modules: ['a', 'm'], adapter: 'node' }, web: { modules: ['w'], adapter: 'client', servedBy: 'api' } })\n",
    "modules/m/module.ts": manifestSrc("m"),
    "modules/m/migrations/0001-x.sql": MIGRATION_BYTES,
    "modules/w/migrations/0001-w.sql": "create table w_notes (id int primary key);\n",
    "modules/m/m.contract.ts":
      "import { contract } from '@keel/router/contract'\nimport { s } from '@keel/schema'\nexport const m = contract('m', {\n  'm.dirs': { method: 'GET', path: '/api/m/dirs', output: s.object({ app: s.string(), dev: s.string() }) },\n})\n",
    "modules/m/dirs.server.ts":
      "import { loader } from '@keel/router'\nimport { ok } from '@keel/schema'\nimport { m } from './m.contract.ts'\nexport const dirs = loader(m, 'm.dirs', {}, async () => ok({ app: process.env.KEEL_APP_DIR ?? '', dev: process.env.KEEL_DEV_DIR ?? '' }))\n",
    "modules/m/routes.ts":
      "import { manifest } from '@keel/router'\nimport { m } from './m.contract.ts'\nimport { dirs } from './dirs.server.ts'\nexport const routes = manifest(m, { 'm.dirs': { loader: dirs } })\n",
  };
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const a = srv.address();
      srv.close(() => (typeof a === "object" && a !== null ? resolve(a.port) : reject(new Error("no port"))));
    });
  });

/** The `{ app, dev }` the loader `m.dirs` answered, or undefined while the server answers anything else. */
export async function dirsOf(port: number): Promise<{ app: string; dev: string } | undefined> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/m/dirs`, { headers: { accept: "application/json" } });
    if (res.status !== 200) return undefined;
    const body: unknown = await res.json();
    const results = typeof body === "object" && body !== null ? Reflect.get(body, "results") : undefined;
    const entry = typeof results === "object" && results !== null ? Reflect.get(results, "m.dirs") : undefined;
    const value = typeof entry === "object" && entry !== null ? Reflect.get(entry, "value") : undefined;
    const app = typeof value === "object" && value !== null ? Reflect.get(value, "app") : undefined;
    const dev = typeof value === "object" && value !== null ? Reflect.get(value, "dev") : undefined;
    return typeof app === "string" && typeof dev === "string" ? { app, dev } : undefined;
  } catch {
    return undefined;
  }
}

/** Starts `argv` as a child of `bin` in `cwd` with `env`, polls `dirsOf` (bounded), runs `fn` with the answer, kills the child's group. */
export async function withDirs(
  command: "dev" | "server",
  dir: string,
  cwd: string,
  env: Record<string, string>,
  fn: (answer: { app: string; dev: string } | undefined) => void,
): Promise<void> {
  const port = await freePort();
  const argv =
    command === "dev"
      ? [BIN, "dev", "--port", String(port), "--format=json"]
      : [join(dir, "dist", "api", "server.mjs")];
  const child: ChildProcess = spawn(process.execPath, argv, {
    cwd,
    env: childEnv({ PORT: String(port), KEEL_SECRET: "s".repeat(32), ...env }),
    stdio: "ignore",
    detached: true,
  });
  try {
    let answer: { app: string; dev: string } | undefined;
    for (let i = 0; i < 800 && answer === undefined && child.exitCode === null; i++) {
      if (i > 0) await pause(50);
      answer = await dirsOf(port);
    }
    fn(answer);
  } finally {
    const pid = child.pid;
    if (pid !== undefined) {
      try {
        process.kill(-pid, "SIGKILL");
      } catch {
        // the group is gone
      }
    }
  }
}
