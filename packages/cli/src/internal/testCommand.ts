/// <reference types="vitest/config" />
import { Writable } from "node:stream";
import { type TestReport, testResults, writeTestReport } from "@keel/testing";
import { writeA11yReport } from "@keel/testing/a11y";
import { type Vitest, startVitest } from "vitest/node";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import { a11yCases } from "./a11yCases.ts";
import { artifactsSetupConfig } from "./artifactsSetupConfig.ts";
import { catchingStray } from "./catchingStray.ts";
import { makeDiag } from "./makeDiag.ts";
import { ownLibrary } from "./ownLibrary.ts";
import { projectFiles } from "./projectFiles.ts";

const sink = (): Writable => new Writable({ write: (_chunk, _enc, done) => done() });
const VITEST_CONFIG = /(^|\/)vitest\.config\.[cm]?[jt]s$/;

const EMPTY: TestReport = { diagnostics: [], tests: 0, failed: 0, skipped: 0, errors: 0 };

/** A run that ended without vitest handing over its instance: a failure, never an empty green report. */
const NOT_STARTED: TestReport = {
  diagnostics: [{ kind: "diag", code: "T0001", message: "vitest ended the run without starting it" }],
  tests: 0,
  failed: 0,
  skipped: 0,
  errors: 1,
};

/** A run vitest ended as not passed with no failing test to show for it (a filter that matches no file): one T0001. */
const notPassed = (r: TestReport, reason: string): TestReport => ({
  ...r,
  diagnostics: [
    ...r.diagnostics,
    { kind: "diag", code: "T0001", message: `no test ran: vitest ended the run as ${reason}` },
  ],
  errors: 1,
});

async function vitestRun(
  root: string,
  filters: readonly string[],
  claims: boolean,
  writeReport: boolean,
): Promise<TestReport> {
  let report = EMPTY;
  let run: Vitest | undefined;
  const collector = {
    onInit: (vitest: Vitest): void => {
      run = vitest;
    },
    onTestRunEnd: (_modules: readonly unknown[], errors: readonly unknown[], reason: string): void => {
      const r = run === undefined ? NOT_STARTED : testResults(run.state.getFiles(), errors, root);
      // The run report (k.test-run Run report), and every render check the harness recorded to `reports/a11y.json`
      // (k.a11y Claims); `keel ledger` reads both.
      if (run !== undefined && writeReport) writeTestReport(root, run.state.getFiles());
      if (run !== undefined && claims) writeA11yReport(root, a11yCases(run.state.getFiles(), root));
      report = reason === "passed" || r.failed > 0 || r.errors > 0 ? r : notPassed(r, reason);
    },
  };
  const exitCode = process.exitCode;
  const previous = process.env.KEEL_TEST;
  const pool = process.env.UV_THREADPOOL_SIZE;
  process.env.KEEL_TEST = "1";
  // One thread-pool thread in every test process, whatever the environment holds (k.drive-law Order): libuv reads it
  // once per process, so it is in the environment the forked test processes start with (`pool: "forks"` below).
  process.env.UV_THREADPOOL_SIZE = "1";
  try {
    const { strays } = await catchingStray(root, async () => {
      const vitest = await startVitest(
        "test",
        [...filters],
        // Forks, whatever the project's config says: each test process then starts with the environment set above.
        {
          root,
          watch: false,
          pool: "forks",
          includeTaskLocation: true,
          reporters: [collector],
          env: { KEEL_TEST: "1", UV_THREADPOOL_SIZE: "1" },
        },
        artifactsSetupConfig(root),
        { stdout: sink(), stderr: sink() },
      );
      await vitest?.close();
    });
    if (strays.length > 0)
      report = { ...report, diagnostics: [...report.diagnostics, ...strays], errors: report.errors + strays.length };
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
    else process.env.KEEL_TEST = previous;
    if (pool === undefined) Reflect.deleteProperty(process.env, "UV_THREADPOOL_SIZE");
    else process.env.UV_THREADPOOL_SIZE = pool;
    process.exitCode = exitCode;
  }
  return report;
}

/**
 * `keel test [paths]`: vitest, programmatically, on `io.cwd` with `KEEL_TEST=1` (k.testing: ctx defaults to sim) and
 * `UV_THREADPOOL_SIZE=1` over any value set (k.drive-law Order), and `@keel/testing/setup` after the project's setup
 * files, so a render given no `artifacts` takes the project's (k.a11y Artifacts);
 * vitest's own output is discarded and `@keel/testing` `testResults` (the same walk the repository's
 * KeelReporter uses) turns results into T0001 diagnostics plus a summary (not ok when any
 * test failed); the run report goes to `reports/tests/run.json` (`writeTestReport`, with vitest's `includeTaskLocation`
 * set) and every render check the harness recorded to `reports/a11y.json` (`writeA11yReport`), but in a
 * library's own folder (`ownLibrary`), which then writes no `reports/a11y.json`. With `report` false (`keel pack`'s
 * test step, which writes no file) no run report is written either. Skipped (the empty run) when `io.files` holds no test file and no vitest config, so an in-memory
 * project never touches disk.
 */
export async function testCommand(input: Input, io: Io, report = true): Promise<OutRecord[]> {
  const runnable = projectFiles(io).some((f) => TEST_FILE.test(f.path) || VITEST_CONFIG.test(f.path));
  // A library holds no page route, so its own folder keeps no render claims (k.library-pack Own folder).
  const r = runnable ? await vitestRun(io.cwd, input.paths ?? [], ownLibrary(io.cwd) === undefined, report) : EMPTY;
  const diags = r.diagnostics.map((d) => makeDiag(d.code, d.message, d));
  const counts = { tests: r.tests, failed: r.failed, skipped: r.skipped };
  return [...diags, { kind: "summary", ok: r.failed === 0 && r.errors === 0, name: "test", counts }];
}
