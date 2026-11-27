// k.e2e-run Teardown: the sweep removes what a SIGKILLed run left and nothing else. The conformance case for the sweep
// cannot age a copy that has no marker (it times the marker it removed), so the sweep's four cases are pinned here.
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { expect, it } from "vitest";
import { RUN_MARKER as MARKER } from "../src/e2e/RUN_MARKER.ts";
import { makeRunFolder } from "../src/e2e/makeRunFolder.ts";
import { sweepRunFolders } from "../src/e2e/sweepRunFolders.ts";

const NOW = Date.parse("2026-01-02T03:04:05.000Z");
/** The ISO start of a run `ageMs` before `NOW`. */
const startedAgo = (ageMs: number): string => {
  const ago = [
    [2 * 3_600_000, "2026-01-02T01:04:05.000Z"],
    [600_000, "2026-01-02T02:54:05.000Z"],
  ].find(([ms]) => ms === ageMs);
  return String(ago?.[1] ?? "");
};
const HOUR = 3_600_000;

/** The pid of a process that ran and exited: one no process holds now. */
const deadPid = (): number => {
  const r = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  return Number(r.stdout);
};

const folder = (outer: string, name: string, marker: { pid: number; ageMs: number } | undefined): string => {
  const dir = join(outer, name);
  mkdirSync(dir);
  if (marker !== undefined)
    writeFileSync(join(dir, MARKER), JSON.stringify({ pid: marker.pid, started: startedAgo(marker.ageMs) }));
  return dir;
};

it("removes a marked folder of a dead process older than an hour, and leaves a young one, a running one's and an unmarked one", () => {
  const outer = tempDir("keel-sweep-");
  const dead = deadPid();
  const stale = folder(outer, "keel-e2e-stale", { pid: dead, ageMs: 2 * HOUR });
  const young = folder(outer, "keel-e2e-young", { pid: dead, ageMs: 10 * 60_000 });
  const running = folder(outer, "keel-e2e-running", { pid: process.pid, ageMs: 2 * HOUR });
  const unmarked = folder(outer, "keel-e2e-unmarked", undefined);
  const garbled = folder(outer, "keel-e2e-garbled", undefined);
  writeFileSync(join(garbled, MARKER), "not a marker");
  const other = folder(outer, "other-stale", { pid: dead, ageMs: 2 * HOUR });
  sweepRunFolders(outer, NOW);
  expect(existsSync(stale)).toBe(false);
  for (const kept of [young, running, unmarked, garbled, other]) expect(existsSync(kept), kept).toBe(true);
});

it("marks a new run folder with this process and its start", () => {
  const dir = makeRunFolder(NOW);
  try {
    expect(dir).toMatch(/keel-e2e-[A-Za-z0-9]{6}$/);
    expect(JSON.parse(readFileSync(join(dir, MARKER), "utf8"))).toEqual({
      pid: process.pid,
      started: "2026-01-02T03:04:05.000Z",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
