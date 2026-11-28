/// <reference types="vitest/config" />

import { Writable } from "node:stream";
import {
  type TestReport,
  type TestRunReport,
  testResults,
  testRunReport as testRunReportOf,
  writeTestReport,
} from "@keel/testing";
import { writeA11yReport } from "@keel/testing/a11y";
import { type Vitest, startVitest } from "vitest/node";
import type { E2eRun } from "./E2eRun.ts";
import { EMPTY_REPORT } from "./EMPTY_REPORT.ts";
import { a11yCases } from "./a11yCases.ts";
import { artifactsSetupConfig } from "./artifactsSetupConfig.ts";
import { catchingStray } from "./catchingStray.ts";

const sink = (): Writable => new Writable({ write: (_chunk, _enc, done) => done() });

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

/**
 * vitest, programmatically, on `root` (testCommand.ts says how); with `e2e` the end-to-end run's options (k.e2e Files).
 * `view.a11y`, the derived `a11y.json` of the tree under test (k.derived Readers), is handed to each test process;
 * `view.frozen` (k.derived Frozen) sets `KEEL_FROZEN`, so the Vite plugin under vitest writes no view either.
 */
export async function vitestRun(
  root: string,
  filters: readonly string[],
  claims: boolean,
  runReport: true | ((report: TestRunReport) => void),
  e2e?: E2eRun,
  view: { readonly a11y?: string | undefined; readonly frozen?: boolean } = {},
): Promise<TestReport> {
  let report = EMPTY_REPORT;
  let run: Vitest | undefined;
  const collector = {
    onInit: (vitest: Vitest): void => {
      run = vitest;
    },
    onTestRunEnd: (_modules: readonly unknown[], errors: readonly unknown[], reason: string): void => {
      const r = run === undefined ? NOT_STARTED : testResults(run.state.getFiles(), errors, root);
      // The run report (k.test-run Run report), and every render check the harness recorded to `reports/a11y.json`
      // (k.a11y Claims); `keel ledger` reads both.
      if (run !== undefined && runReport === true) writeTestReport(root, run.state.getFiles());
      else if (run !== undefined && runReport !== true) runReport(testRunReportOf(root, run.state.getFiles()));
      if (run !== undefined && claims) writeA11yReport(root, a11yCases(run.state.getFiles(), root));
      report = reason === "passed" || r.failed > 0 || r.errors > 0 ? r : notPassed(r, reason);
    },
  };
  const exitCode = process.exitCode;
  const previous = process.env.KEEL_TEST;
  const pool = process.env.UV_THREADPOOL_SIZE;
  const wasFrozen = process.env.KEEL_FROZEN;
  process.env.KEEL_TEST = "1";
  if (view.frozen === true) process.env.KEEL_FROZEN = "1";
  // One thread-pool thread in every test process, whatever the environment holds (k.drive-law Order): libuv reads it
  // once per process, so it is in the environment the forked test processes start with (`pool: "forks"` below).
  process.env.UV_THREADPOOL_SIZE = "1";
  const saved = new Map(Object.keys(e2e?.env ?? {}).map((k) => [k, process.env[k]]));
  for (const [k, v] of Object.entries(e2e?.env ?? {})) process.env[k] = v;
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
          env: { KEEL_TEST: "1", UV_THREADPOOL_SIZE: "1", ...e2e?.env },
          ...(e2e === undefined
            ? {}
            : {
                include: [...e2e.include],
                environment: "node",
                maxWorkers: 2,
                testTimeout: e2e.timeout,
                hookTimeout: e2e.timeout,
              }),
        },
        artifactsSetupConfig(root, view.a11y),
        { stdout: sink(), stderr: sink() },
      );
      await vitest?.close();
    });
    if (strays.length > 0)
      report = { ...report, diagnostics: [...report.diagnostics, ...strays], errors: report.errors + strays.length };
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
    else process.env.KEEL_TEST = previous;
    if (wasFrozen === undefined) Reflect.deleteProperty(process.env, "KEEL_FROZEN");
    else process.env.KEEL_FROZEN = wasFrozen;
    for (const [k, v] of saved) {
      if (v === undefined) Reflect.deleteProperty(process.env, k);
      else process.env[k] = v;
    }
    if (pool === undefined) Reflect.deleteProperty(process.env, "UV_THREADPOOL_SIZE");
    else process.env.UV_THREADPOOL_SIZE = pool;
    process.exitCode = exitCode;
  }
  return report;
}
