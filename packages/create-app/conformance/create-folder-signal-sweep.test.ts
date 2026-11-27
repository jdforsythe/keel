// k.create-folder, Folder "A failed write is E1365, a SIGINT or SIGTERM during the writes E1367 (exit 130 or 143): the files and folders this run made are removed."
// Seed 1337 (recorded; the delays are a fixed list, not drawn). A signal is sent at each of a spread of delays after the process is spawned, so no case depends on one chosen
// stall point: before the bin's handler exists, between its writes, and after it has finished. The delay is a blocking `Atomics.wait` in the test (no timer API).
// Reading asserted: a run that exits 130/143 (or dies of the signal before its handler exists) leaves the folder exactly as it was, an empty folder the run made counting as gone;
// a run that finished before the signal (exit 0) is not judged here. `.keel-create` may remain only where it lists every other path that remains.
import { type ChildProcess, spawn } from "node:child_process";
import { join } from "node:path";
import { testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it } from "vitest";
import { BIN, PNPM, SEED, cleanAll, entries, envOf, put, run, sandbox, tree } from "./create-bin-support.ts";

void SEED;
const T = testTime(110_000);
// 0 to 60 ms in steps of 3 around the 15 to 45 ms window where a write is in flight, then a tail to 150 ms.
const DELAYS: number[] = [...Array.from({ length: 21 }, (_, i) => i * 3), 70, 80, 90, 100, 120, 150];
const MIN_INTERRUPTED = 3;
const CODE = { SIGINT: 130, SIGTERM: 143 } as const;

const sleep = (ms: number): void => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

type Ended = { status: number | null; signal: NodeJS.Signals | null; out: string };
function runSignalled(args: string[], cwd: string, signal: NodeJS.Signals, delayMs: number): Promise<Ended> {
  return new Promise((resolve) => {
    const child: ChildProcess = spawn(process.execPath, [BIN, ...args], {
      cwd,
      env: envOf(PNPM),
      stdio: ["pipe", "pipe", "pipe"],
    });
    let out = "";
    child.stdout?.setEncoding("utf8").on("data", (d: string) => {
      out += d;
    });
    child.stderr?.setEncoding("utf8").on("data", (d: string) => {
      out += d;
    });
    child.stdin?.on("error", () => {
      // the child may exit before a pipe is closed
    });
    child.on("error", (e) => resolve({ status: null, signal: null, out: `${out}${String(e)}` }));
    child.on("close", (status, sig) => resolve({ status, signal: sig, out }));
    sleep(delayMs);
    child.kill(signal);
  });
}

afterAll(cleanAll);

describe("k.create-folder: a SIGINT or SIGTERM during the writes", () => {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    it(
      `a ${signal} during the writes, across delays, leaves a new folder as it was (gone or empty), exit ${CODE[signal]}, and no \`.keel-create\` that lists nothing it should`,
      async () => {
        let interrupted = 0;
        for (const delay of DELAYS) {
          const cwd = sandbox();
          const r = await runSignalled(["shop"], cwd, signal, delay);
          const where = `${signal} at ${delay} ms: status ${String(r.status)} signal ${String(r.signal)}\n${r.out}`;
          if (r.status === 0) continue;
          expect(r.status === CODE[signal] || (r.status === null && r.signal === signal), where).toBe(true);
          interrupted += 1;
          const left = entries(join(cwd, "shop"));
          const marker = tree(join(cwd, "shop")).get(".keel-create");
          if (marker !== undefined)
            for (const p of left.filter((e) => e !== ".keel-create"))
              expect(marker, `${p} remains but is not listed: ${where}`).toContain(p);
          expect(left, `the folder the run made holds files: ${where}`).toEqual([]);
          expect(
            entries(cwd).filter((e) => e !== "shop/"),
            where,
          ).toEqual([]);
        }
        expect(interrupted, "too few runs were interrupted for the sweep to mean anything").toBeGreaterThanOrEqual(
          MIN_INTERRUPTED,
        );
      },
      T,
    );

    it(
      `a ${signal} during the writes, across delays, with \`--existing\` leaves every earlier file byte-identical and no new file or folder, \`README.md\` included, exit ${CODE[signal]}`,
      async () => {
        let interrupted = 0;
        for (const delay of DELAYS) {
          const cwd = sandbox();
          put(cwd, "shop/notes.txt", "keep\n");
          put(cwd, "shop/sub/deep.txt", "deep\n");
          const beforeEntries = entries(join(cwd, "shop"));
          const beforeTree = tree(join(cwd, "shop"));
          const r = await runSignalled(["shop", "--existing"], cwd, signal, delay);
          const where = `${signal} at ${delay} ms: status ${String(r.status)} signal ${String(r.signal)}\n${r.out}`;
          if (r.status === 0) continue;
          expect(r.status === CODE[signal] || (r.status === null && r.signal === signal), where).toBe(true);
          interrupted += 1;
          const marker = tree(join(cwd, "shop")).get(".keel-create");
          if (marker !== undefined)
            for (const p of entries(join(cwd, "shop")).filter(
              (e) => !beforeEntries.includes(e) && e !== ".keel-create",
            ))
              expect(marker, `${p} remains but is not listed: ${where}`).toContain(p);
          expect(entries(join(cwd, "shop")), `entries changed: ${where}`).toEqual(beforeEntries);
          expect(tree(join(cwd, "shop")), `file bytes changed: ${where}`).toEqual(beforeTree);
        }
        expect(interrupted, "too few runs were interrupted for the sweep to mean anything").toBeGreaterThanOrEqual(
          MIN_INTERRUPTED,
        );
      },
      T,
    );

    it(
      `a ${signal} during the writes, across delays, with \`--existing\` leaves no \`README.md\` behind, and the next run writes it with its content`,
      async () => {
        let interrupted = 0;
        for (const delay of DELAYS) {
          const cwd = sandbox();
          put(cwd, "shop/notes.txt", "keep\n");
          const r = await runSignalled(["shop", "--existing"], cwd, signal, delay);
          const where = `${signal} at ${delay} ms: status ${String(r.status)} signal ${String(r.signal)}\n${r.out}`;
          if (r.status === 0) continue;
          interrupted += 1;
          expect(tree(join(cwd, "shop")).has("README.md"), `a README.md remains: ${where}`).toBe(false);
          const next = await run(["shop", "--existing"], cwd);
          expect(next.status, `${where}\nnext run: ${next.out}`).toBe(0);
          expect((tree(join(cwd, "shop")).get("README.md") ?? "").length, where).toBeGreaterThan(0);
        }
        expect(interrupted, "too few runs were interrupted for the sweep to mean anything").toBeGreaterThanOrEqual(
          MIN_INTERRUPTED,
        );
      },
      T,
    );
  }
});
