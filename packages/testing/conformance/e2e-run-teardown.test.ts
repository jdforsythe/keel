// @vitest-environment node
// Spec: k.e2e-run, clause "After a passing run, a failing run and a run stopped by SIGINT, no `keel-e2e-*` folder of that run is left in the OS temporary folder, and the SIGINT run printed one `stopped:` line."
// Spec: k.e2e-run, clause "A `keel-e2e-*` folder whose `.keel-e2e` names a process that is not running and that is 2 hours old is gone after the next run starts; one that is 10 minutes old, or names a running process, or has no `.keel-e2e`, is left."
// Seed: n/a (no generated input). Method: the real `keel test --e2e` as a child process over a fixture project (e2e-support.ts) whose `TMPDIR` is a folder of the case alone, so "the OS temporary folder" holds only what that run made.
// SIGINT: the child is spawned, the case waits (`vi.waitFor`, bounded by `testTime`) for the marker file the fixture's test writes once its `serve` answers, then sends SIGINT and reads the exit code and output.
// The sweep: a run killed by SIGKILL leaves a real run folder; the cases copy it and age the copies. UNTESTABLE as stated: the spec names no seam for the clock the sweep reads and no format for `.keel-e2e` ("its process id and start time"), so a copy is aged both ways a reader could use: its files'
// and folder's modification times and every ISO date or epoch number in the marker file are moved back; the pid of the dead run is replaced by this process's pid for the "names a running process" copy. The reading of "is 2 hours old" is that age since the run's start.
// ASSUMED: (1) `stopped:` goes to stdout in the compact format; (2) the fixture's test waits by `Atomics.wait` in 100 ms steps (a test may not use a timer) for a `stop` file, at most 600 steps; a SIGKILLed run's worker then ends on its own once the case writes that file.
import { type ChildProcess, spawn } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import { afterAll, describe, expect, it, vi } from "vitest";
import { BIN, cleanEnv, cleanup, keelE2e, project, suite } from "./e2e-support.ts";
import { PAGES, nodeApp } from "./fixtures/e2e/node-app.ts";

const privates: string[] = [];
const fresh = (): string => {
  const d = mkdtempSync(join(tmpdir(), "keel-private-"));
  privates.push(d);
  return d;
};
afterAll(() => {
  for (const d of privates) rmSync(d, { recursive: true, force: true });
  cleanup();
});
const runFolders = (tmp: string): string[] => readdirSync(tmp).filter((n) => n.startsWith("keel-e2e-"));

const IMPORT_SERVE = "import { serve } from '@keel/testing/e2e'";
const WAIT = `const wait = (file: string): void => {
  for (let i = 0; i < 600 && !existsSync(file); i++) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100)
}`;
const passing = suite(
  [IMPORT_SERVE],
  [{ title: "a passing serve", body: "const app = await serve()\nexpect((await app.fetch('/')).status).toBe(200)" }],
);
const failing = suite(
  [IMPORT_SERVE],
  [{ title: "a failing serve", body: "const app = await serve()\nexpect((await app.fetch('/')).status).toBe(201)" }],
);
const waiting = suite(
  ["import { existsSync, writeFileSync } from 'node:fs'", IMPORT_SERVE, WAIT],
  [
    {
      title: "a serve that waits to be stopped",
      body: "const app = await serve()\nexpect((await app.fetch('/')).status).toBe(200)\nwriteFileSync('ready', String(process.pid))\nwait('stop')",
    },
  ],
);
const idle = suite(
  ["import { existsSync, writeFileSync } from 'node:fs'", WAIT],
  [
    {
      title: "a test that waits to be killed",
      body: "writeFileSync('ready', String(process.pid))\nwait('stop')\nexpect(1).toBe(1)",
    },
  ],
);
const quick = suite([], [{ title: "a test that passes", body: "expect(1).toBe(1)" }]);

/** The ISO text of `ms` since the epoch (UTC), from the civil-date arithmetic alone. */
function isoOf(ms: number): string {
  const days = Math.floor(ms / 86_400_000);
  const rest = ms - days * 86_400_000;
  const z = days + 719_468;
  const era = Math.floor(z / 146_097);
  const doe = z - era * 146_097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36_524) - Math.floor(doe / 146_096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const day = doy - Math.floor((153 * mp + 2) / 5) + 1;
  const month = mp < 10 ? mp + 3 : mp - 9;
  const year = yoe + era * 400 + (month <= 2 ? 1 : 0);
  const two = (n: number): string => String(n).padStart(2, "0");
  const h = Math.floor(rest / 3_600_000);
  const m = Math.floor((rest % 3_600_000) / 60_000);
  const sec = (rest % 60_000) / 1000;
  return `${year}-${two(month)}-${two(day)}T${two(h)}:${two(m)}:${two(Math.floor(sec))}.${String(Math.round((sec % 1) * 1000)).padStart(3, "0")}Z`;
}

function launch(dir: string, tmp: string): { child: ChildProcess; out: () => string; closed: Promise<number | null> } {
  const child = spawn(process.execPath, [BIN, "test", "--e2e", "--format=compact"], {
    cwd: dir,
    env: cleanEnv({ TMPDIR: tmp, KEEL_TEST_TIME_SCALE: "1" }),
  });
  let text = "";
  child.stdout?.on("data", (d: Buffer) => {
    text += d.toString("utf8");
  });
  const closed = new Promise<number | null>((resolve) => child.on("close", (code) => resolve(code)));
  return { child, out: () => text, closed };
}
async function ready(dir: string): Promise<void> {
  await vi.waitFor(() => expect(existsSync(join(dir, "ready"))).toBe(true), {
    timeout: testTime(300_000),
    interval: 250,
  });
}

describe("k.e2e-run teardown", () => {
  it(
    "After a passing run, a failing run and a run stopped by SIGINT, no `keel-e2e-*` folder of that run is left in the OS temporary folder, and the SIGINT run printed one `stopped:` line.",
    async () => {
      const files = { "test/pass.e2e.ts": passing.source, "test/fail.e2e.ts": failing.source };
      const tmp = fresh();
      const dir = project({ ...nodeApp(Object.values(PAGES)), ...files });
      const mixed = keelE2e(dir, [], { env: { TMPDIR: tmp } });
      expect(mixed.status).toBe(1);
      expect(runFolders(tmp), "after a passing and a failing run").toEqual([]);
      const only = keelE2e(dir, ["test/pass.e2e.ts"], { env: { TMPDIR: tmp } });
      expect(only.status).toBe(0);
      expect(runFolders(tmp), "after a passing run").toEqual([]);

      const tmp2 = fresh();
      const stopDir = project({ ...nodeApp(Object.values(PAGES)), "test/wait.e2e.ts": waiting.source });
      const run = launch(stopDir, tmp2);
      await ready(stopDir);
      expect(runFolders(tmp2)).toHaveLength(1);
      run.child.kill("SIGINT");
      const code = await run.closed;
      writeFileSync(join(stopDir, "stop"), "1");
      expect(code).toBe(130);
      expect(
        run
          .out()
          .split("\n")
          .filter((l) => l.startsWith("stopped:")),
      ).toHaveLength(1);
      expect(run.out()).toMatch(/^stopped: removed \d+ processes and the run folder$/m);
      expect(runFolders(tmp2), "after SIGINT").toEqual([]);
    },
    testTime(900_000),
  );

  it(
    "A `keel-e2e-*` folder whose `.keel-e2e` names a process that is not running and that is 2 hours old is gone after the next run starts; one that is 10 minutes old, or names a running process, or has no `.keel-e2e`, is left.",
    async () => {
      // A real leftover: a run killed by SIGKILL.
      const tmp = fresh();
      const killed = project({ ...nodeApp(Object.values(PAGES)), "test/idle.e2e.ts": idle.source });
      const run = launch(killed, tmp);
      await ready(killed);
      run.child.kill("SIGKILL");
      await run.closed;
      writeFileSync(join(killed, "stop"), "1");
      const [template] = runFolders(tmp);
      expect(template, "the SIGKILLed run left its folder").toBeDefined();
      if (template === undefined) return;
      const marker = join(tmp, template, ".keel-e2e");
      expect(existsSync(marker), "the folder holds .keel-e2e").toBe(true);
      const text = readFileSync(marker, "utf8");
      const now = statSync(join(tmp, template)).mtimeMs;
      const HOUR = fixedTime(3_600_000);
      const copy = (name: string, ageMs: number, pid: string | undefined, withMarker: boolean): string => {
        const to = join(tmp, name);
        cpSync(join(tmp, template), to, { recursive: true });
        const shifted = text
          .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, (d) => isoOf(Date.parse(d) - ageMs))
          .replace(/\b\d{13}\b/g, (n) => String(Number(n) - ageMs))
          .replace(/\b1\d{9}\b/g, (n) => String(Number(n) - Math.round(ageMs / 1000)));
        const body = pid === undefined ? shifted : shifted.replaceAll(String(run.child.pid), pid);
        if (withMarker) writeFileSync(join(to, ".keel-e2e"), body);
        else rmSync(join(to, ".keel-e2e"));
        const at = (now - ageMs) / 1000;
        if (withMarker) utimesSync(join(to, ".keel-e2e"), at, at);
        utimesSync(to, at, at);
        return name;
      };
      const stale = copy("keel-e2e-stale", 2 * HOUR, undefined, true);
      const young = copy("keel-e2e-young", fixedTime(600_000), undefined, true);
      const running = copy("keel-e2e-running", 2 * HOUR, String(process.pid), true);
      const unmarked = copy("keel-e2e-unmarked", 2 * HOUR, undefined, false);
      const dir = project({ ...nodeApp(Object.values(PAGES)), "test/quick.e2e.ts": quick.source });
      keelE2e(dir, [], { env: { TMPDIR: tmp } });
      const left = runFolders(tmp);
      expect(left, "2 hours old, dead process, marked: swept").not.toContain(stale);
      expect(left, "10 minutes old: left").toContain(young);
      expect(left, "names a running process: left").toContain(running);
      expect(left, "no .keel-e2e: left").toContain(unmarked);
    },
    testTime(900_000),
  );
});
