// The hard watchdog (watchdog.ts) run for real: a child vitest over fixtures that never yield. Real processes and
// real timers: the subject is a wall-clock bound enforced from outside the spinning thread. Every child starts in
// its own process group, and each test kills that group in `finally`, so a failing test leaves nothing behind.
import { type ChildProcess, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { fixedTime, testTime } from "../test-time.ts";

const root = path.join(import.meta.dirname, "..", "..");
const fixtures = path.join(import.meta.dirname, "..", "fixtures", "watchdog");
const vitest = path.join(root, "node_modules", "vitest", "vitest.mjs");
// testTimeout and hookTimeout 200 ms (the fixture config): allowed 200 + 2 * 200, bound 600 * 2 + 500 = 1.7 s. The
// fixture's times are the watchdog's input, so the child vitest runs them unscaled; this file's own waits scale.
const env = {
  ...process.env,
  KEEL_WATCHDOG_GRACE_MS: "500",
  KEEL_WATCHDOG_TICK_MS: "100",
  KEEL_AGENT: "1",
  KEEL_TEST_TIME_SCALE: "1",
};

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

/** How a child run ended. */
type End = { code: number | null; signal: NodeJS.Signals | null };

/** The child's exit, once its output is read to the end or 2 s after it exits (a grandchild may hold the pipes). */
async function ended(child: ChildProcess): Promise<End> {
  let closed = false;
  child.once("close", () => {
    closed = true;
  });
  const end = await new Promise<End>((resolve) => child.once("exit", (code, signal) => resolve({ code, signal })));
  await within(testTime(2000), () => closed);
  return end;
}

/**
 * An assertion's message: how the child ended and its output, its lines joined on one line (the reporter prints a
 * message's first line, up to 512 characters), the last 440 characters of it.
 */
function said(end: End, out: string): string {
  const flat = out
    .split("\n")
    .filter((l) => l.trim() !== "")
    .join(" | ");
  const tail = flat.length > 440 ? `...${flat.slice(-440)}` : flat;
  return `child exit ${end.code} signal ${end.signal}: ${tail}`;
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
      const end = await ended(child);
      expect(end.code, said(end, out)).not.toBe(0);
      expect(performance.now() - t0, said(end, out)).toBeLessThan(fixedTime(1_700) + testTime(23_000));
      const lines = out.split("\n").filter((l) => l.includes("watchdog"));
      expect(lines, said(end, out)).toHaveLength(1);
      expect(lines[0], said(end, out)).toMatch(
        /^T0001 spin\.fixture\.ts:1:1 watchdog killed "spins without yielding" after \d+\.\ds \(bound 1\.7s\)$/,
      );
      expect(await within(testTime(10_000), () => child.pid !== undefined && group(child.pid).length === 0)).toBe(true);
    } finally {
      killGroup(child.pid);
    }
  }, 60_000);

  it("kills a worker whose file import never returns, within the collection allowance and grace", async () => {
    const child = run("hang-import.fixture.ts", { KEEL_WATCHDOG_COLLECT_MS: "300" });
    let out = "";
    child.stdout?.on("data", (b: Buffer) => {
      out += String(b);
    });
    child.stderr?.on("data", (b: Buffer) => {
      out += String(b);
    });
    try {
      const end = await ended(child);
      expect(end.code, said(end, out)).not.toBe(0);
      expect(out, said(end, out)).toMatch(
        /T0001 hang-import\.fixture\.ts:1:1 watchdog killed after \d+\.\ds \(bound 1\.1s\)/,
      );
      expect(await within(testTime(10_000), () => child.pid !== undefined && group(child.pid).length === 0)).toBe(true);
    } finally {
      killGroup(child.pid);
    }
  }, 60_000);

  it("does not kill a slow import at time scale 0.01: the collection allowance and grace are fixed time", async () => {
    // The import holds the thread 2.5 s. Scaled, the allowance would be 60 s * 0.01 * 2 + 0.5 s = 1.7 s.
    const child = run("slow-import.fixture.ts", { KEEL_TEST_TIME_SCALE: "0.01" });
    let out = "";
    child.stdout?.on("data", (b: Buffer) => {
      out += String(b);
    });
    child.stderr?.on("data", (b: Buffer) => {
      out += String(b);
    });
    try {
      const end = await ended(child);
      expect(out, said(end, out)).not.toContain("watchdog killed");
      expect(end.code, said(end, out)).toBe(0);
    } finally {
      killGroup(child.pid);
    }
  }, 60_000);

  it("kills an orphaned worker once vitest itself is gone", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "keel-watchdog-"));
    const ready = path.join(dir, "ready");
    const child = run("orphan.fixture.ts", { KEEL_WATCHDOG_READY: ready });
    try {
      expect(await within(testTime(15_000), () => fs.existsSync(ready))).toBe(true);
      const worker = Number(fs.readFileSync(ready, "utf8"));
      expect(child.pid === undefined ? [] : group(child.pid)).toContain(worker);
      child.kill("SIGKILL");
      expect(await within(testTime(3000), () => child.pid !== undefined && group(child.pid).length === 0)).toBe(true);
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
          expect(
            await within(testTime(20_000), () => fs.existsSync(ready) && fs.readFileSync(ready, "utf8").includes(" ")),
          ).toBe(true);
          pids = fs.readFileSync(ready, "utf8").split(" ").map(Number);
          expect(pids.every(alive)).toBe(true);
          if (child.pid !== undefined) end(child.pid);
          expect(await within(testTime(8000), () => !pids.some(alive))).toBe(true);
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
