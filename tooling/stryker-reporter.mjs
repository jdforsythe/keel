// Compact Stryker reporter: prints exactly one trailer line per docs/OUTPUT.md (NDJSON summary with KEEL_FORMAT=json;
// Stryker's CLI rejects unknown flags). While the run is going it keeps `.stryker-tmp/progress.json` current for
// `pnpm mutate:status`, ends a run whose runner died, and records the dry run's time per test file for the quick-first order.
import fs from "node:fs";
import path from "node:path";
import { mutateCacheDir, packageRelative } from "./mutate-cache.ts";

export const PROGRESS = path.join(".stryker-tmp", "progress.json");

class KeelReporter {
  static inject = ["options"];
  constructor(options) {
    this.options = options;
    this.t0 = Date.now();
    this.unit = path.basename(process.cwd());
    this.pkg = this.unit + (process.env.KEEL_MUTATE_SHARD ? ` shard ${process.env.KEEL_MUTATE_SHARD}` : "");
    this.progress = { total: 0, reused: 0, tested: 0, killed: 0, survived: 0, timeout: 0, startedAt: this.t0 };
    this.written = 0;
    this.parent = process.ppid;
  }
  /** A run whose runner is gone has nobody to end it at the budget: it ends itself, once, and saves. */
  orphaned() {
    const file = process.env.KEEL_MUTATE_RUN;
    if (!file || process.ppid === this.parent) return;
    this.parent = process.ppid;
    try {
      const r = JSON.parse(fs.readFileSync(file, "utf8"));
      if (r.signalled) return;
      fs.writeFileSync(file, JSON.stringify({ ...r, signalled: true }));
    } catch {
      // No run file: nobody else can signal this run.
    }
    process.kill(process.pid, "SIGINT");
  }
  save(force) {
    const now = Date.now();
    if (!force && now - this.written < 1000) return;
    this.written = now;
    fs.mkdirSync(path.dirname(PROGRESS), { recursive: true });
    fs.writeFileSync(PROGRESS, JSON.stringify({ ...this.progress, at: now }));
  }
  onDryRunCompleted(event) {
    const times = {};
    for (const t of event.result.tests) {
      if (!t.fileName) continue;
      const f = packageRelative(t.fileName);
      times[f] = Math.round((times[f] ?? 0) + t.timeSpentMs);
    }
    const file = process.env.KEEL_TEST_TIMES ?? path.join(mutateCacheDir(), `${this.unit}.times.json`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(times));
  }
  onMutationTestingPlanReady(event) {
    this.progress.total = event.mutantPlans.length;
    this.progress.reused = event.mutantPlans.filter((p) => p.plan !== "Run").length;
    this.save(true);
  }
  onMutantTested(result) {
    const p = this.progress;
    p.tested++;
    if (result.status === "Killed") p.killed++;
    else if (result.status === "Survived") p.survived++;
    else if (result.status === "Timeout") p.timeout++;
    this.save(false);
    this.orphaned();
  }
  onMutationTestReportReady(_report, metrics) {
    this.save(true);
    const threshold = this.options.thresholds.break ?? 0;
    const m = metrics.systemUnderTestMetrics.metrics;
    const score = Number.isNaN(m.mutationScore) ? 100 : m.mutationScore;
    const ok = score >= threshold;
    const ms = Date.now() - this.t0;
    if (process.env.KEEL_FORMAT === "json" || process.argv.some((a) => a === "--format=json")) {
      const counts = { killed: m.killed, survived: m.survived, timeout: m.timeout, noCoverage: m.noCoverage };
      console.log(
        JSON.stringify({
          kind: "summary",
          ok,
          name: `mutate ${this.pkg}`,
          counts: { ...counts, score: Number(score.toFixed(1)), threshold },
          ms,
        }),
      );
    } else {
      console.log(`${ok ? "ok" : "fail"} mutate ${this.pkg} score ${score.toFixed(1)}% (threshold ${threshold}%)`);
    }
  }
}

export const strykerPlugins = [{ kind: "Reporter", name: "keel", injectableClass: KeelReporter }];
