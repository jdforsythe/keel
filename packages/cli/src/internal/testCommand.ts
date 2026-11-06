import { Writable } from "node:stream";
import { startVitest } from "vitest/node";
import type { Input } from "../types/Input.ts";
import type { Io } from "../types/Io.ts";
import type { OutRecord } from "../types/OutRecord.ts";
import { TEST_FILE } from "./TEST_FILE.ts";
import type { TestTally } from "./TestTally.ts";
import { collectResults } from "./collectResults.ts";
import { projectFiles } from "./projectFiles.ts";

const sink = (): Writable => new Writable({ write: (_chunk, _enc, done) => done() });
const VITEST_CONFIG = /(^|\/)vitest\.config\.[cm]?[jt]s$/;

async function vitestRun(root: string, filters: readonly string[]): Promise<TestTally> {
  let tally: TestTally = { diags: [], tests: 0, failed: 0, skipped: 0 };
  const collector = {
    onFinished: (files: readonly unknown[] = [], errors: readonly unknown[] = []): void => {
      tally = collectResults(root, files, errors);
    },
  };
  const exitCode = process.exitCode;
  const previous = process.env.KEEL_TEST;
  process.env.KEEL_TEST = "1";
  try {
    const vitest = await startVitest(
      "test",
      [...filters],
      { root, watch: false, reporters: [collector], env: { KEEL_TEST: "1" } },
      {},
      { stdout: sink(), stderr: sink() },
    );
    await vitest?.close();
  } finally {
    if (previous === undefined) Reflect.deleteProperty(process.env, "KEEL_TEST");
    else process.env.KEEL_TEST = previous;
    process.exitCode = exitCode;
  }
  return tally;
}

/**
 * `keel test [paths]`: vitest, programmatically, on `io.cwd` with `KEEL_TEST=1` (k.testing: ctx defaults to sim);
 * vitest's own output is discarded and results come back as T0001 diagnostics plus a summary (not ok when any
 * test failed). Skipped (the empty run) when `io.files` holds no test file and no vitest config, so an in-memory
 * project never touches disk.
 */
export async function testCommand(input: Input, io: Io): Promise<OutRecord[]> {
  const runnable = projectFiles(io).some((f) => TEST_FILE.test(f.path) || VITEST_CONFIG.test(f.path));
  const tally = runnable ? await vitestRun(io.cwd, input.paths ?? []) : { diags: [], tests: 0, failed: 0, skipped: 0 };
  const counts = { tests: tally.tests, failed: tally.failed, skipped: tally.skipped };
  return [...tally.diags, { kind: "summary", ok: tally.failed === 0, name: "test", counts }];
}
