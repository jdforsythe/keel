// Ends a fake Stryker group the way `mutate:stop` and the runner's budget path do. Real processes and real timers:
// this test is about wall-clock bounds on processes, so it cannot run under a simulated clock.
import { type ChildProcess, spawn } from "node:child_process";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { endGroup, listGroup, signalGroup } from "../mutate.mjs";

const stubborn = path.join(import.meta.dirname, "..", "fixtures", "group", "stubborn.mjs");

/** Starts the fake in its own group and resolves once its child exists: `[leader, child]`. */
function start(): Promise<{ proc: ChildProcess; pids: number[] }> {
  const proc = spawn(process.execPath, [stubborn], { detached: true, stdio: ["ignore", "pipe", "ignore"] });
  return new Promise((resolve, reject) => {
    proc.stdout?.once("data", (b: Buffer) => {
      const child = Number(String(b).trim());
      if (proc.pid === undefined) reject(new Error("the fake did not start"));
      else resolve({ proc, pids: [proc.pid, child] });
    });
    proc.once("error", reject);
  });
}

describe("endGroup", () => {
  it("SIGKILLs a group that ignores its SIGINT past the grace period and leaves no process of it", async () => {
    const { proc, pids } = await start();
    const pgid = pids[0] ?? 0;
    try {
      expect(listGroup(pgid).sort()).toEqual([...pids].sort());
      expect(signalGroup(pgid, "SIGINT")).toBe(true);
      const end = await endGroup(pgid, { graceMs: 300, pollMs: 50 });
      expect(end).toEqual({ killed: true, left: [] });
      expect(listGroup(pgid)).toEqual([]);
      expect(signalGroup(pgid, "SIGINT")).toBe(false);
    } finally {
      signalGroup(pgid, "SIGKILL");
      proc.unref();
    }
  }, 15_000);

  it("returns without a kill when the group is already empty", async () => {
    const { proc, pids } = await start();
    const pgid = pids[0] ?? 0;
    try {
      signalGroup(pgid, "SIGKILL");
      expect(await endGroup(pgid, { graceMs: 2000, pollMs: 50 })).toEqual({ killed: false, left: [] });
    } finally {
      signalGroup(pgid, "SIGKILL");
      proc.unref();
    }
  }, 15_000);
});
