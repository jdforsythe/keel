import path from "node:path";
// Stryker's CLI rejects unknown flags, so NDJSON output is selected with KEEL_FORMAT=json.

// Compact Stryker reporter: prints exactly one trailer line per docs/OUTPUT.md (NDJSON summary with --format=json).
class KeelReporter {
  static inject = ["options"];
  constructor(options) {
    this.options = options;
    this.t0 = Date.now();
  }
  onMutationTestReportReady(_report, metrics) {
    const pkg = path.basename(process.cwd());
    const threshold = this.options.thresholds.break ?? 0;
    const m = metrics.systemUnderTestMetrics.metrics;
    const score = Number.isNaN(m.mutationScore) ? 100 : m.mutationScore;
    const ok = score >= threshold;
    const ms = Date.now() - this.t0;
    if (process.env.KEEL_FORMAT === "json" || process.argv.some((a) => a === "--format=json")) {
      const counts = { killed: m.killed, survived: m.survived, timeout: m.timeout, noCoverage: m.noCoverage };
      console.log(JSON.stringify({ kind: "summary", ok, name: `mutate ${pkg}`, counts: { ...counts, score: Number(score.toFixed(1)), threshold }, ms }));
    } else {
      console.log(`${ok ? "ok" : "fail"} mutate ${pkg} score ${score.toFixed(1)}% (threshold ${threshold}%)`);
    }
  }
}

export const strykerPlugins = [{ kind: "Reporter", name: "keel", injectableClass: KeelReporter }];
