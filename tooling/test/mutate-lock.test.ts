// The mutation lock and the stall cut-off, driven by fixture processes (tooling/fixtures/mutate), never by Stryker.
// Every process a test starts is killed by that test, by process group where it has one.
import { type ChildProcess, spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { stallCheck } from "../mutate.mjs";
import { acquire, ancestors, busyDiag, heldBy, holderAlive, lockedDiag } from "../mutateLock.mjs";
import { fixedTime } from "../test-time.ts";

const fixtures = path.join(import.meta.dirname, "..", "fixtures", "mutate");
const mutateBin = path.join(import.meta.dirname, "..", "mutate.mjs");

const dirs: string[] = [];
const procs: ChildProcess[] = [];
afterEach(() => {
  for (const p of procs.splice(0)) if (p.pid !== undefined) kill(p.pid);
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

function kill(pid: number): void {
  for (const target of [-pid, pid])
    try {
      process.kill(target, "SIGKILL");
    } catch {}
}
const temp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "keel-mutate-test-"));
  dirs.push(d);
  return d;
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const alive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** Starts a fixture and resolves with it once its stdout has printed `until`. Output so far is in `out`. */
function start(script: string, args: string[], until: string): Promise<{ child: ChildProcess; out: () => string }> {
  const child = spawn(process.execPath, [path.join(fixtures, script), ...args], {
    stdio: ["ignore", "pipe", "inherit"],
  });
  procs.push(child);
  let text = "";
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${script} printed no "${until}": ${text}`)), 8000);
    child.stdout?.on("data", (b: Buffer) => {
      text += b.toString("utf8");
      if (text.includes(until)) {
        clearTimeout(timer);
        resolve({ child, out: () => text });
      }
    });
  });
}

describe("the lock", () => {
  it("is taken once: a second taker is refused with the holder's pid", async () => {
    const file = path.join(temp(), "keel-mutate.lock");
    const { child } = await start("holder-mutate.mjs", [file], "held");
    expect(acquire({ file })).toEqual({ held: false, holder: child.pid });
    expect(heldBy(file)).toBe(child.pid);
    expect(lockedDiag(child.pid ?? 0).code).toBe("E0010");
    expect(busyDiag(child.pid ?? 0).code).toBe("W0012");
  });

  it("lets a process the holder started pass", async () => {
    const file = path.join(temp(), "keel-mutate.lock");
    const { out } = await start("holder-mutate.mjs", [file, "--child"], "passed");
    expect(out()).toContain("held\npassed");
  });

  it("is taken over when its holder is gone", async () => {
    const file = path.join(temp(), "keel-mutate.lock");
    const { child } = await start("holder-mutate.mjs", [file], "held");
    const pid = child.pid ?? 0;
    kill(pid);
    for (let i = 0; i < 100 && alive(pid); i++) await sleep(50);
    expect(heldBy(file)).toBeUndefined();
    const lock = acquire({ file });
    expect(lock.held).toBe(true);
    expect(JSON.parse(fs.readFileSync(file, "utf8")).pid).toBe(process.pid);
    lock.held && lock.release();
    expect(fs.existsSync(file)).toBe(false);
  });

  it("is taken over when its pid is alive but is no mutation command", () => {
    const file = path.join(temp(), "keel-mutate.lock");
    fs.writeFileSync(file, JSON.stringify({ pid: process.pid }));
    expect(holderAlive(process.pid, /no-such-command-line/)).toBe(false);
    expect(acquire({ file, pid: 999999, match: /no-such-command-line/ }).held).toBe(true);
  });

  it("ignores an unreadable lock file", () => {
    const file = path.join(temp(), "keel-mutate.lock");
    fs.writeFileSync(file, "not json");
    expect(heldBy(file)).toBeUndefined();
    expect(acquire({ file, pid: 424242 }).held).toBe(true);
    fs.rmSync(file, { force: true });
  });

  it("lists the ancestors of a pid from a ps listing", () => {
    const listing = "  1  0\n  10  1\n  20  10\n  30  20\n  99  1\n";
    expect(ancestors(listing, 30)).toEqual([20, 10]);
    expect(ancestors(listing, 99)).toEqual([]);
  });
});

describe("stallCheck", () => {
  it("restarts the clock on every finished mutant and fires after the limit without one", () => {
    let s = { tested: -2, since: 0 };
    let r = stallCheck(s, { tested: 3 }, 1000, 5000);
    expect(r.stalled).toBe(false);
    s = r.state;
    r = stallCheck(s, { tested: 3 }, 5999, 5000);
    expect(r.stalled).toBe(false);
    r = stallCheck(r.state, { tested: 3 }, 6000, 5000);
    expect(r.stalled).toBe(true);
    r = stallCheck(r.state, { tested: 4 }, 7000, 5000);
    expect(r.stalled).toBe(false);
  });
  it("counts a run with no progress file yet from its start", () => {
    const r = stallCheck({ tested: -2, since: 0 }, undefined, 100, 5000);
    expect(r.stalled).toBe(false);
    expect(stallCheck(r.state, undefined, 5100, 5000).stalled).toBe(true);
  });
});

/** Runs mutate.mjs in a fresh package directory against a fixture Stryker; resolves with its output and exit code. */
async function runMutate(dir: string, lock: string, bin: string[], env: Record<string, string> = {}) {
  const pkg = path.join(dir, "ctx");
  fs.mkdirSync(pkg, { recursive: true });
  const child = spawn(process.execPath, [mutateBin, ...bin], {
    cwd: pkg,
    stdio: ["ignore", "pipe", "pipe"],
    env: {
      ...process.env,
      KEEL_AGENT: "1",
      KEEL_MUTATE_LOCK: lock,
      KEEL_MUTATE_BIN: path.join(fixtures, "stryker-bin.mjs"),
      KEEL_MUTATE_POLL_MS: "100",
      ...env,
    },
  });
  procs.push(child);
  let out = "";
  child.stdout?.on("data", (b: Buffer) => {
    out += b.toString("utf8");
  });
  const code = await new Promise<number | null>((resolve) => child.on("close", resolve));
  const pidFile = path.join(pkg, "child.pid");
  const pid = fs.existsSync(pidFile) ? Number(fs.readFileSync(pidFile, "utf8")) : undefined;
  const left = pid !== undefined && alive(pid);
  if (pid !== undefined) kill(pid);
  return { out, code, pid, left };
}

describe("pnpm mutate (mutate.mjs) with a fixture Stryker", () => {
  it("refuses a second run with E0010 and starts no Stryker", async () => {
    const dir = temp();
    const lock = path.join(dir, "keel-mutate.lock");
    await start("holder-mutate.mjs", [lock], "held");
    const r = await runMutate(dir, lock, ["run"]);
    expect(r.code).toBe(1);
    expect(r.out).toMatch(/^E0010 a mutation run is live \(pid \d+\)$/m);
    expect(r.pid).toBeUndefined();
  });

  it(
    "ends a run with no finished mutant for the stall limit with E0011, exit 1, and no process left",
    async () => {
      const dir = temp();
      const r = await runMutate(dir, path.join(dir, "keel-mutate.lock"), ["run"], { KEEL_MUTATE_STALL_MS: "1500" });
      expect(r.code).toBe(1);
      expect(r.out).toContain("E0011 mutation run stalled at 3/8 mutants");
      expect(r.out).toContain("no process left");
      expect(r.pid).toBeDefined();
      expect(r.left).toBe(false);
      expect(fs.existsSync(path.join(dir, "keel-mutate.lock"))).toBe(false);
    },
    fixedTime(30000),
  );

  it(
    "leaves a run that keeps finishing mutants alone",
    async () => {
      const dir = temp();
      const r = await runMutate(dir, path.join(dir, "keel-mutate.lock"), ["run", "--advance"], {
        KEEL_MUTATE_STALL_MS: "1000",
      });
      expect(r.code).toBe(0);
      expect(r.out).not.toContain("E0011");
    },
    fixedTime(30000),
  );

  it(
    "writes E0011 as a diag record under --format=json",
    async () => {
      const dir = temp();
      const r = await runMutate(dir, path.join(dir, "keel-mutate.lock"), ["run"], {
        KEEL_MUTATE_STALL_MS: "1000",
        KEEL_FORMAT: "json",
      });
      const records = r.out
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l));
      expect(records[0]).toMatchObject({ kind: "diag", code: "E0011", message: "mutation run stalled at 3/8 mutants" });
      expect(records[1]).toMatchObject({ kind: "summary", ok: false });
    },
    fixedTime(30000),
  );
});
