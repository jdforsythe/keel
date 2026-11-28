// k.cli Dev watcher, "`keel dev` reads `KEEL_DEV_POLL` once at start, in its own process: `1` passes Vite `server.watch` `usePolling: true` and `interval: 100` over the project's `server.watch`, whose other keys stay; unset, empty or `0` passes none, so the project's Vite config decides; any other value prints one E1560 (k.deploy) naming `KEEL_DEV_POLL` and not the value, listens on no port and exits 1."
// Spec: k.topology, clause "In a fixture whose `vite.config.ts` sets `server.watch: { usePolling: false, interval: 1000 }` and holds a plugin that writes `config.server.watch` to a file in `configResolved`, `keel dev` with `KEEL_DEV_POLL=1` records `usePolling: true` and `interval: 100`; with `KEEL_DEV_POLL` unset, `''` or `0` it records `usePolling: false` and `interval: 1000`."
// Spec: k.topology, clause "`keel dev` with `KEEL_DEV_POLL=true`, and with `KEEL_DEV_POLL=2`, prints one E1560 line naming `KEEL_DEV_POLL` and not the value, listens on no port and exits 1."
// Seed 1337 (the rejected values of the property are generated). Real binary over a temp project with `@keel/*` and `vite` linked. Each child gets the
// parent's environment without `KEEL_*`, `VITE_*` and `CHOKIDAR_USEPOLLING`, plus exactly what the case sets: no case relies on the harness setting a polling variable.
// Ports come from a listener on port 0 closed first, passed with `--port`. Waits are retries with a fixed pause, bounded by a count. Each child's process group is
// ended in `afterEach`. Untestable: "reads `KEEL_DEV_POLL` once at start" (a running process's environment cannot change from outside); the cases pin the value read at start.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import net from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as pause } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import fc from "fast-check";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";
import { SEED, cleanup, materialize, write } from "./compat-support.ts";
import { nodeTree } from "./boundary-support.ts";

const SLOW = 300_000;
const REPO = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const BIN = join(REPO, "packages", "cli", "src", "bin.ts");

let dir = "";
let outDir = "";
let record = "";
beforeAll(() => {
  outDir = realpathSync(mkdtempSync(join(tmpdir(), "keel-dev-poll-out-")));
  record = join(outDir, "watch.json");
  const vite =
    'import keel from "@keel/compiler/vite";\nimport { writeFileSync } from "node:fs";\nimport { defineConfig } from "vite";\n' +
    `const recordWatch = { name: "record-watch", configResolved(config) { writeFileSync(${JSON.stringify(record)}, JSON.stringify(config.server.watch ?? null)); } };\n` +
    "export default defineConfig({ server: { watch: { usePolling: false, interval: 1000, binaryInterval: 300 } }, plugins: [keel(), recordWatch] });\n";
  dir = realpathSync(materialize({ ...nodeTree("node") }));
  write(dir, { "vite.config.ts": vite });
});
afterAll(() => {
  cleanup(dir);
  cleanup(outDir);
});

/** The parent's environment without the test runner's keys, `KEEL_*`, `VITE_*` and `CHOKIDAR_USEPOLLING`, plus `extra`. */
const childEnv = (extra: Record<string, string>): Record<string, string> => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined) continue;
    if (
      k.startsWith("VITEST") ||
      k === "NODE_OPTIONS" ||
      k === "TEST" ||
      k === "PORT" ||
      k === "CHOKIDAR_USEPOLLING" ||
      k.startsWith("KEEL_") ||
      k.startsWith("VITE_")
    )
      continue;
    env[k] = v;
  }
  return { ...env, ...extra };
};

type Proc = { child: ChildProcess; out: () => string; exited: Promise<number | null>; port: number };
const started = new Set<Proc>();

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

/** `keel dev --port <free>` with `KEEL_DEV_POLL` set to `poll` (not set at all when undefined). */
async function startDev(poll: string | undefined): Promise<Proc> {
  rmSync(record, { force: true });
  const port = await freePort();
  const child = spawn(process.execPath, [BIN, "dev", "--port", String(port), "--format=json"], {
    cwd: dir,
    env: childEnv(poll === undefined ? {} : { KEEL_DEV_POLL: poll }),
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
  const proc: Proc = { child, out: () => buf, exited, port };
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

/** SIGTERM to `p`'s process group, SIGKILL if it has not closed 10 s later. */
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

/** Waits (1800 pauses of 50 ms at most) until the plugin has written the record or the process exits; the parsed record, or null. */
async function recorded(p: Proc): Promise<Record<string, unknown> | null> {
  let done = false;
  void p.exited.then(() => {
    done = true;
  });
  for (let i = 0; i < 1800 && !done; i++) {
    if (i > 0) await pause(50);
    if (!existsSync(record)) continue;
    const text = readFileSync(record, "utf8");
    if (text === "") continue;
    const v: unknown = JSON.parse(text);
    return typeof v === "object" && v !== null ? Object.fromEntries(Object.entries(v)) : null;
  }
  return null;
}

const accepts = (port: number): Promise<boolean> =>
  new Promise((res) => {
    const sock = net.connect({ port, host: "localhost" });
    sock.once("connect", () => {
      sock.destroy();
      res(true);
    });
    sock.once("error", () => res(false));
  });

const e1560 = (text: string): string[] => text.split("\n").filter((l) => l.includes("E1560"));

describe("k.topology Dev watcher (rfc:0211)", () => {
  test(
    "`KEEL_DEV_POLL=1` passes Vite `server.watch` `usePolling: true` and `interval: 100` over the project's own `server.watch`, whose other keys stay",
    async () => {
      const p = await startDev("1");
      const watch = await recorded(p);
      expect(watch, p.out()).not.toBeNull();
      expect(watch?.usePolling).toBe(true);
      expect(watch?.interval).toBe(100);
      expect(watch?.binaryInterval).toBe(300);
      await stop(p);
    },
    SLOW,
  );

  test(
    "with `KEEL_DEV_POLL` unset, `''` or `0` `keel dev` passes no `server.watch`: the project's `usePolling: false` and `interval: 1000` stand",
    async () => {
      for (const poll of [undefined, "", "0"]) {
        const p = await startDev(poll);
        const watch = await recorded(p);
        expect(watch, `${JSON.stringify(poll)}: ${p.out()}`).not.toBeNull();
        expect(watch?.usePolling, JSON.stringify(poll)).toBe(false);
        expect(watch?.interval, JSON.stringify(poll)).toBe(1000);
        expect(watch?.binaryInterval, JSON.stringify(poll)).toBe(300);
        await stop(p);
      }
    },
    SLOW,
  );

  test(
    "any other value (`true`, `2`, `yes`, ` 1`, a generated string) prints one E1560 naming `KEEL_DEV_POLL` and not the value, listens on no port and exits 1",
    async () => {
      const check = async (poll: string, valueIsDistinct: boolean): Promise<void> => {
        const p = await startDev(poll);
        const code = await p.exited;
        const out = p.out();
        expect(code, `${JSON.stringify(poll)}: ${out}`).toBe(1);
        const lines = e1560(out);
        expect(lines, out).toHaveLength(1);
        expect(lines[0]).toContain("KEEL_DEV_POLL");
        if (valueIsDistinct) expect(out).not.toContain(poll);
        expect(out).not.toMatch(new RegExp(`(?:localhost|127\\.0\\.0\\.1|\\[::1\\]):${p.port}\\b`));
        expect(await accepts(p.port)).toBe(false);
      };
      for (const poll of ["true", "2", "yes", " 1"]) await check(poll, false);
      await fc.assert(
        fc.asyncProperty(fc.stringMatching(/^[qxz][a-z0-9]{7,11}$/), (poll) => check(poll, true)),
        { seed: SEED, numRuns: 6 },
      );
    },
    SLOW,
  );

  test(
    "`keel dev` with `KEEL_DEV_POLL=true`, and with `KEEL_DEV_POLL=2`, prints one E1560 line naming `KEEL_DEV_POLL` and not the value, listens on no port and exits 1",
    async () => {
      for (const poll of ["true", "2"]) {
        const p = await startDev(poll);
        expect(await p.exited, p.out()).toBe(1);
        const lines = e1560(p.out());
        expect(lines).toHaveLength(1);
        expect(lines[0]).toContain("KEEL_DEV_POLL");
        expect(lines[0]).not.toContain(`=${poll}`);
        expect(await accepts(p.port)).toBe(false);
      }
    },
    SLOW,
  );
});
