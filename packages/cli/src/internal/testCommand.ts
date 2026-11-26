import { existsSync, readdirSync } from "node:fs";
import type { TestRunReport } from "@keel/testing";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { EMPTY_REPORT } from "./EMPTY_REPORT.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import { makeDiag } from "./makeDiag.ts";
import { ownLibrary } from "./ownLibrary.ts";
import { projectFiles } from "./projectFiles.ts";
import { vitestRun } from "./vitestRun.ts";

const VITEST_CONFIG = /(^|\/)vitest\.config\.[cm]?[jt]s$/;

/**
 * `keel test [paths]`: vitest, programmatically, on `io.cwd` with `KEEL_TEST=1` (k.testing: ctx defaults to sim) and
 * `UV_THREADPOOL_SIZE=1` over any value set (k.drive-law Order), and `@keel/testing/setup` after the project's setup
 * files, so a render given no `artifacts` takes the project's (k.a11y Artifacts);
 * vitest's own output is discarded and `@keel/testing` `testResults` (the same walk the repository's
 * KeelReporter uses) turns results into T0001 diagnostics plus a summary (not ok when any
 * test failed); the run report goes to `reports/tests/run.json` (`writeTestReport`, with vitest's `includeTaskLocation`
 * set) and every render check the harness recorded to `reports/a11y.json` (`writeA11yReport`), but in a
 * library's own folder (`ownLibrary`), which then writes no `reports/a11y.json`. With `report` a function (`keel pack`'s
 * test step, which writes no file) the run report (`testRunReport`) is handed to it and not written. Skipped (the
 * empty run) when `io.files` holds no test file and `io.cwd` no vitest config, so an in-memory project never touches disk.
 */
export async function testCommand(
  input: Input,
  io: Io,
  report: true | ((run: TestRunReport) => void) = true,
): Promise<OutRecord[]> {
  // Behind its own entry, loaded only for `--e2e` (`@keel/cli` size budget).
  if (input.e2e === true) return (await import("@keel/cli/e2e")).e2eCommand(input, io);
  const configured = existsSync(io.cwd) && readdirSync(io.cwd).some((n) => VITEST_CONFIG.test(n));
  const runnable = configured || projectFiles(io).some((f) => TEST_FILE.test(f.path));
  // A library holds no page route, so its own folder keeps no render claims (k.library-pack Own folder).
  const r = runnable
    ? await vitestRun(io.cwd, input.paths ?? [], ownLibrary(io.cwd) === undefined, report)
    : EMPTY_REPORT;
  const diags = r.diagnostics.map((d) => makeDiag(d.code, d.message, d));
  const counts = { tests: r.tests, failed: r.failed, skipped: r.skipped };
  return [...diags, { kind: "summary", ok: r.failed === 0 && r.errors === 0, name: "test", counts }];
}
