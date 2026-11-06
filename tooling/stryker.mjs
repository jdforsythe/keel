// Shared Stryker config factory (backlog 0036). Per package: `export default strykerConfig("schema", 80);`.
// Thresholds come from docs/TESTING.md. Output follows docs/OUTPUT.md: one trailer line, NDJSON with --format=json.
import path from "node:path";

export const REPORTER = path.join(import.meta.dirname, "stryker-reporter.mjs");

/** @param {string} pkg short package name (the reporter reads it from `cwd`; kept for the call-site contract) @param {number} threshold minimum mutation score (percent) @param {number} [floor] temporary `break` below threshold (needs a TODO + backlog line) */
export function strykerConfig(pkg, threshold, floor = threshold) {
  return {
    mutate: ["src/**/*.ts", "!src/index.ts", "!src/types/**"],
    testRunner: "vitest",
    vitest: { configFile: "vitest.config.ts" },
    plugins: ["@stryker-mutator/vitest-runner", REPORTER],
    checkers: [],
    incremental: true,
    incrementalFile: ".stryker-tmp/incremental.json",
    tempDirName: ".stryker-tmp",
    reporters: ["json", "keel"],
    jsonReporter: { fileName: "reports/mutation/mutation.json" },
    thresholds: { high: 90, low: threshold, break: floor },
    logLevel: "fatal",
    fileLogLevel: "off",
    ignoreStatic: true,
  };
}
