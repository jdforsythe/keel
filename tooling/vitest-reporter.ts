// Vitest reporter implementing docs/OUTPUT.md: silent passes, failures as T0001 diagnostics, one trailer.
// The task-tree walk (frames, compact diff, messages) is `testResults` from @keel/testing: one implementation,
// shared with `keel test`. Imported by path: tooling is private and @keel/testing depends on it.
import type { Vitest } from "vitest/node";
import type { Reporter } from "vitest/reporters";
import { testResults } from "../packages/testing/src/testResults.ts";
import type { Diag, Summary } from "./output.ts";
import { emit } from "./output.ts";

export class KeelReporter implements Reporter {
  private t0 = performance.now();
  private run: Vitest | undefined;

  onInit(vitest: Vitest): void {
    this.run = vitest;
  }

  onTestRunEnd(_modules: readonly unknown[], errors: readonly unknown[]): void {
    const r = testResults(this.run?.state.getFiles() ?? [], errors, process.cwd());
    const diags: Diag[] = r.diagnostics.map((d) => ({ ...d }));
    const bad = r.failed > 0 || r.errors > 0;
    const summary: Summary = {
      kind: "summary",
      ok: !bad,
      counts: { tests: r.tests, failed: r.failed, skipped: r.skipped },
      ms: performance.now() - this.t0,
    };
    const text = emit([...diags, summary]);
    if (text) process.stdout.write(`${text}\n`);
    if (bad) process.exitCode = 1;
  }
}
