// k.evaluator End: an evaluator ends when the command that started it is killed outright (SIGKILL), whether its code
// yields (its standard input pipe closes) or loops without yielding (its processor-time limit).
import { type ChildProcess, execFileSync, spawn } from "node:child_process";
import { mkdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, test } from "vitest";

const started: ChildProcess[] = [];
const evaluators: number[] = [];
afterAll(() => {
  for (const c of started) if (c.exitCode === null && c.signalCode === null) c.kill("SIGKILL");
  for (const pid of evaluators) if (alive(pid)) process.kill(pid, "SIGKILL");
});

function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** The pids whose parent is `pid`. */
function childrenOf(pid: number): number[] {
  try {
    return execFileSync("pgrep", ["-P", String(pid)], { encoding: "utf8" })
      .split("\n")
      .filter((l) => l.trim() !== "")
      .map(Number);
  } catch {
    return [];
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

async function until(ok: () => boolean, ms: number): Promise<boolean> {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (ok()) return true;
    await sleep(25);
  }
  return ok();
}

/** Starts the helper on `source` with `deadlineMs`, waits for its evaluator, kills the helper; the evaluator's pid. */
async function killMidEvaluation(source: string, deadlineMs: number): Promise<number> {
  const dir = path.join(realpathSync(tempDir(".tmp-killed-", import.meta.dirname)), "entry");
  mkdirSync(dir);
  const entry = path.join(dir, "entry.mjs");
  writeFileSync(entry, source);
  const helper = spawn(
    process.execPath,
    [path.join(import.meta.dirname, "evaluate-killed-child.ts"), entry, String(deadlineMs)],
    { stdio: "ignore" },
  );
  started.push(helper);
  const pid = helper.pid ?? 0;
  expect(await until(() => childrenOf(pid).length > 0, testTime(10_000))).toBe(true);
  const kids = childrenOf(pid);
  evaluators.push(...kids);
  // The evaluator has run its entry for a while before the command is killed.
  await sleep(300);
  helper.kill("SIGKILL");
  return kids[0] ?? 0;
}

describe("k.evaluator End: a command killed with SIGKILL leaves no evaluator behind", () => {
  test(
    "an evaluator in a loop that never yields ends at its processor-time limit",
    async () => {
      const pid = await killMidEvaluation("for (;;) {}", 1000);
      expect(alive(pid)).toBe(true);
      expect(await until(() => !alive(pid), testTime(15_000))).toBe(true);
    },
    testTime(40_000),
  );

  test(
    "an evaluator whose code yields ends when the command's pipe closes, long before its deadline",
    async () => {
      const pid = await killMidEvaluation("setInterval(() => {}, 10); await new Promise(() => {})", 30_000);
      expect(await until(() => !alive(pid), testTime(5_000))).toBe(true);
    },
    testTime(40_000),
  );
});
