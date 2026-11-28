// Spec: k.create-folder, clause "A run's `.keel-create` lists each file of the plan, then each folder the run makes inside the folder, `/`-ended, deepest first. After a `kill -9` at any moment of the writes, in a new folder and with `--existing` in one holding files and an empty folder, removing each listed path that exists, in order (`rm` a file, `rmdir` a folder), then `.keel-create`, leaves the folder with the entries and bytes it had before the run (none, for a new folder), and a second run exits 0."
// Seed 1337 (recorded; the stages are a fixed list, not drawn). SIGKILL is sent once `.keel-create` exists and N further entries exist in the folder, for several N (polled with a blocking `Atomics.wait`, no timer API), so each counted run is killed mid-write by construction, whatever the machine's speed. The poll is bounded by MAX_POLLS.
// Only runs killed mid-write count: the process died of SIGKILL and left a `.keel-create`. A run that finished first, or died before it wrote the marker, is not judged here.
// ASSUMED (the spec gives the marker's content, not its syntax): one path per line, relative to the folder, a folder ending in `/`, `.keel-create` itself not listed.
import { type ChildProcess, spawn } from "node:child_process";
import { existsSync, readFileSync, rmSync, rmdirSync } from "node:fs";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import {
  BIN,
  PNPM,
  SEED,
  cleanAll,
  entries,
  envOf,
  put,
  run,
  sandbox,
  tree,
  waitForWrites,
} from "./create-bin-support.ts";

void SEED;
const T = testTime(110_000);
// Entries that must exist beside the marker before the kill: 0 is right after the marker is written, the rest at later points of the writes.
const STAGES: number[] = [0, 1, 2, 3, 4, 6, 8, 12];
const MIN_KILLED = 3;

type Ended = { status: number | null; signal: NodeJS.Signals | null };
function runKilled(args: string[], cwd: string, before: readonly string[], stage: number): Promise<Ended> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn(process.execPath, [BIN, ...args], {
      cwd,
      env: envOf(PNPM),
      stdio: ["pipe", "pipe", "pipe"],
    });
    child.stdin?.on("error", () => {
      // the child may exit before a pipe is closed
    });
    child.on("error", () => resolve({ status: null, signal: null }));
    child.on("close", (status, signal) => resolve({ status, signal }));
    waitForWrites(join(cwd, "shop"), before, stage);
    child.kill("SIGKILL");
  });
}

const listed = (folder: string): string[] =>
  readFileSync(join(folder, ".keel-create"), "utf8")
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l !== "");

/** Removes what the marker lists, in order (a file with rm, a folder with rmdir, each only where it exists), then the marker. */
function undo(folder: string, paths: string[]): void {
  for (const p of paths) {
    const full = join(folder, p);
    if (!existsSync(full)) continue;
    if (p.endsWith("/")) rmdirSync(full);
    else rmSync(full);
  }
  rmSync(join(folder, ".keel-create"));
}

/** Every listed folder comes after every listed path inside it. */
function foldersAfterContents(paths: string[]): string | undefined {
  for (const [i, p] of paths.entries()) {
    if (!p.endsWith("/")) continue;
    const inside = paths.findIndex((q) => q !== p && q.startsWith(p));
    const last = paths.reduce((acc, q, j) => (q !== p && q.startsWith(p) ? j : acc), -1);
    if (inside !== -1 && last > i) return `${p} (position ${i}) precedes ${paths[last] ?? ""} (position ${last})`;
  }
  return undefined;
}

afterAll(cleanAll);

describe("k.create-folder: `.keel-create` after a kill -9", () => {
  it(
    "after a `kill -9` at any moment of the writes in a new folder, removing each listed path that exists, in order, then `.keel-create`, leaves the folder with no entries, and a second run exits 0",
    async () => {
      let killed = 0;
      for (const stage of STAGES) {
        const cwd = sandbox();
        const folder = join(cwd, "shop");
        const r = await runKilled(["shop"], cwd, [], stage);
        const where = `kill -9 after the marker and ${stage} entries: status ${String(r.status)} signal ${String(r.signal)}`;
        if (r.signal !== "SIGKILL" || !existsSync(join(folder, ".keel-create"))) continue;
        killed += 1;
        const paths = listed(folder);
        expect(paths.length, where).toBeGreaterThan(0);
        expect(foldersAfterContents(paths), where).toBeUndefined();
        for (const e of entries(folder).filter((x) => x !== ".keel-create"))
          expect(paths, `${e} remains but is not listed: ${where}`).toContain(e);
        undo(folder, paths);
        expect(entries(folder), where).toEqual([]);
        const next = await run(["shop"], cwd);
        expect(next.status, `${where}\nnext run: ${next.out}`).toBe(0);
      }
      expect(killed, "too few runs were killed mid-write for the sweep to mean anything").toBeGreaterThanOrEqual(
        MIN_KILLED,
      );
    },
    T,
  );

  it(
    "after a `kill -9` at any moment of the writes with `--existing` in a folder holding files and an empty folder, removing each listed path that exists, in order, then `.keel-create`, leaves the entries and bytes it had before the run, and a second run exits 0",
    async () => {
      let killed = 0;
      for (const stage of STAGES) {
        const cwd = sandbox();
        const folder = join(cwd, "shop");
        put(cwd, "shop/notes.txt", "keep\n");
        put(cwd, "shop/sub/deep.txt", "deep\n");
        put(cwd, "shop/public/.hold", "");
        rmSync(join(folder, "public/.hold"));
        const beforeEntries = entries(folder);
        const beforeTree = tree(folder);
        expect(beforeEntries).toContain("public/");
        const r = await runKilled(["shop", "--existing"], cwd, beforeEntries, stage);
        const where = `kill -9 after the marker and ${stage} entries: status ${String(r.status)} signal ${String(r.signal)}`;
        if (r.signal !== "SIGKILL" || !existsSync(join(folder, ".keel-create"))) continue;
        killed += 1;
        const paths = listed(folder);
        expect(paths.length, where).toBeGreaterThan(0);
        expect(foldersAfterContents(paths), where).toBeUndefined();
        for (const e of entries(folder).filter((x) => !beforeEntries.includes(x) && x !== ".keel-create"))
          expect(paths, `${e} remains but is not listed: ${where}`).toContain(e);
        undo(folder, paths);
        expect(entries(folder), where).toEqual(beforeEntries);
        expect(tree(folder), where).toEqual(beforeTree);
        const next = await run(["shop", "--existing"], cwd);
        expect(next.status, `${where}\nnext run: ${next.out}`).toBe(0);
      }
      expect(killed, "too few runs were killed mid-write for the sweep to mean anything").toBeGreaterThanOrEqual(
        MIN_KILLED,
      );
    },
    T,
  );
});
