// A real `keel dev` over a `client` + `node` project, for the inspect-document conformance files (not a test file).
// Public surface only: the `keel` binary over a temp project with `@keel/*` and `vite` linked. Seed 1337 where a file draws inputs.
import { type ChildProcess, spawn } from "node:child_process";
import net from "node:net";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import { type Tree, childEnv, clientTree, materialize } from "./boundary-support.ts";

const BIN = fileURLToPath(new URL("../src/bin.ts", import.meta.url));

/** Section `a.x` (a string) is registered by the `node` deployable's module `a`, the one the page also serves. */
export const SERVED = "from-api";
export const ID = "a.x";

/** `clientTree()` (`node` `api` with module `a`, `client` `web` with module `w`) whose module `a` registers section `a.x`. */
export function devTree(): Tree {
  const tree = clientTree();
  const routes = tree["modules/a/routes.ts"] ?? "";
  return {
    ...tree,
    "modules/a/routes.ts": `import './inspect.server.ts'\n${routes}`,
    "modules/a/inspect.server.ts": `import { inspector } from '@keel/compiler/inspect/inspector'\nimport { s } from '@keel/schema'\ninspector({ id: '${ID}', schema: s.string(), read: () => '${SERVED}' })\n`,
  };
}

const freePort = (): Promise<number> =>
  new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.once("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => (typeof addr === "object" && addr !== null ? resolve(addr.port) : reject(new Error("no port"))));
    });
  });

export type Dev = { port: number; origin: string; output: () => string; stop: () => void };

/** `keel dev --port <free>` over `dir`; resolves once `GET /__keel/inspect` answers 200 (bounded retries, fixed pause). */
export async function startDev(dir: string): Promise<Dev> {
  const port = await freePort();
  const child: ChildProcess = spawn(process.execPath, [BIN, "dev", "--port", String(port), "--format=json"], {
    cwd: dir,
    env: childEnv({}),
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
  const stop = (): void => {
    const pid = child.pid;
    if (pid === undefined || child.exitCode !== null || child.signalCode !== null) return;
    try {
      process.kill(-pid, "SIGKILL");
    } catch {
      // the group is gone
    }
  };
  const origin = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 1200 && child.exitCode === null; i++) {
    if (i > 0) await pause(50);
    const up = await fetch(`${origin}/__keel/inspect`).then(
      (r) => r.status === 200,
      () => false,
    );
    if (up) return { port, origin, output: () => buf, stop };
  }
  stop();
  throw new Error(`keel dev did not serve /__keel/inspect:\n${buf}`);
}

/** The page of deployable `deployable` posting its sections, as the dev entry does (own `Origin`). */
export async function post(dev: Dev, deployable: string, sections: Record<string, unknown>): Promise<number> {
  const res = await fetch(`${dev.origin}/__keel/inspect`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: dev.origin },
    body: JSON.stringify({ graph: { nodes: [], edges: [] }, stores: {}, sections, deployable }),
  });
  return res.status;
}

/** The inspect document as parsed JSON. */
export async function document(dev: Dev): Promise<unknown> {
  return (await fetch(`${dev.origin}/__keel/inspect`)).json();
}

export const at = (v: unknown, ...keys: string[]): unknown => {
  let cur: unknown = v;
  for (const k of keys) cur = typeof cur === "object" && cur !== null ? Reflect.get(cur, k) : undefined;
  return cur;
};

export { materialize };
