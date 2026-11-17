// The hard watchdog (watchdog.ts) run for real: a child vitest over fixtures that never yield. Real processes and
// real timers: the subject is a wall-clock bound enforced from outside the spinning thread. Every child starts in
// its own process group, and each test kills that group in `finally`, so a failing test leaves nothing behind.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = path.join(import.meta.dirname, "..", "..");
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "watchdog");
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
// testTimeout and hookTimeout 200 ms (the fixture config): allowed 200 + 2 * 200, bound 600 * 2 + 500 = 1.7 s.
const env = { ...process.env, KEEL_WATCHDOG_GRACE_MS: "500", KEEL_WATCHDOG_TICK_MS: "100", KEEL_AGENT: "1" };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Pids of every live process in group `pgid`. */
function group(pgid: number): number[] {
  const r = spawnSync("ps", ["-A", "-o", "pid=,pgid="], { encoding: "utf8" });
  return r.stdout
    .split("\n")
    .map((l) => l.trim().split(/\s+/).map(Number))
    .filter(([pid, g]) => Number.isInteger(pid) && g === pgid)
    .map(([pid]) => pid ?? 0);
}

function killGroup(pgid: number | undefined): void {
  if (pgid === undefined) return;
  try {
    process.kill(-pgid, "SIGKILL");
  } catch {}
}

/** Polls `done` every 50 ms for up to `ms`; true when it held. */
async function within(ms: number, done: () => boolean): Promise<boolean> {
  const deadline = performance.now() + ms;
  while (performance.now() < deadline) {
    if (done()) return true;
    await sleep(50);
  }
  return done();
}

function run(file: string, extra: Record<string, string> = {}): ChildProcess {
  return spawn(process.execPath, [vitest, "run", file], {
    cwd: fixtures,
    env: { ...env, ...extra },
    detached: true,
    stdio: ["ignore", "pipe", "pipe"],
  });
}

describe("watchdog", () => {
  it("kills a worker stuck in a synchronous loop, prints one T0001 line, and the run fails", async () => {
    const t0 = performance.now();
    const child = run("spin.fixture.ts");
    let out = "";
    child.stdout?.on("data", (b: Buffer) => {
      out += String(b);
    });
    child.stderr?.on("data", (b: Buffer) => {
      out += String(b);
    });
    try {
      const code = await new Promise<number | null>((resolve) => child.once("exit", (c) => resolve(c)));
      expect(code).not.toBe(0);
      expect(performance.now() - t0).toBeLessThan(25_000);
      const lines = out.split("\n").filter((l) => l.includes("watchdog"));
      expect(lines).toHaveLength(1);
      expect(lines[0]).toMatch(
        /^T0001 spin\.fixture\.ts:1:1 watchdog killed "spins without yielding" after \d+\.\ds \(bound 1\.7s\)$/,
      );
      expect(await within(10_000, () => child.pid !== undefined && group(child.pid).length === 0)).toBe(true);
    } finally {
      killGroup(child.pid);
    }
  }, 60_000);

  it("kills an orphaned worker once vitest itself is gone", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-watchdog-"));
    const ready = path.join(dir, "ready");
    const child = run("orphan.fixture.ts", { KEEL_WATCHDOG_READY: ready });
    try {
      expect(await within(15_000, () => fs.existsSync(ready))).toBe(true);
      const worker = Number(fs.readFileSync(ready, "utf8"));
      expect(child.pid === undefined ? [] : group(child.pid)).toContain(worker);
      child.kill("SIGKILL");
      expect(await within(3000, () => child.pid !== undefined && group(child.pid).length === 0)).toBe(true);
    } finally {
      killGroup(child.pid);
      fs.rmSync(dir, { recursive: true, force: true });
    }
  }, 30_000);

  describe("a worker's child process", () => {
    const alive = (pid: number): boolean => {
      try {
        process.kill(pid, 0);
        return true;
      } catch {
        return false;
      }
    };
    const ways = [
      { how: "vitest gets SIGTERM", end: (pid: number) => process.kill(pid, "SIGTERM") },
      { how: "vitest gets SIGINT", end: (pid: number) => process.kill(pid, "SIGINT") },
      { how: "vitest gets SIGHUP", end: (pid: number) => process.kill(pid, "SIGHUP") },
      { how: "vitest gets SIGKILL", end: (pid: number) => process.kill(pid, "SIGKILL") },
      { how: "the whole process group gets SIGTERM", end: (pid: number) => process.kill(-pid, "SIGTERM") },
    ];
    for (const { how, end } of ways) {
      it(`does not outlive the worker when ${how}`, async () => {
        const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-watchdog-"));
        const ready = path.join(dir, "ready");
        const child = run("child.fixture.ts", { KEEL_WATCHDOG_READY: ready });
        let pids: number[] = [];
        try {
          expect(await within(20_000, () => fs.existsSync(ready) && fs.readFileSync(ready, "utf8").includes(" "))).toBe(
            true,
          );
          pids = fs.readFileSync(ready, "utf8").split(" ").map(Number);
          expect(pids.every(alive)).toBe(true);
          if (child.pid !== undefined) end(child.pid);
          expect(await within(8000, () => !pids.some(alive))).toBe(true);
        } finally {
          for (const pid of pids) {
            try {
              process.kill(pid, "SIGKILL");
            } catch {}
          }
          killGroup(child.pid);
          fs.rmSync(dir, { recursive: true, force: true });
        }
      }, 40_000);
    }
  });
});
