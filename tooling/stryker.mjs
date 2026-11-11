// Shared Stryker config factory. Per package: `export default strykerConfig("schema", 80);`.
// Thresholds come from docs/TESTING.md. Output follows docs/OUTPUT.md: one trailer line, NDJSON with KEEL_FORMAT=json.
import path from "node:path";
import { mutateCacheDir } from "./mutate-cache.ts";

export const REPORTER = path.join(import.meta.dirname, "stryker-reporter.mjs");
/** Vitest config for a package that has none of its own for mutation runs. */
export const VITEST = path.join(import.meta.dirname, "vitest.mutate.config.ts");

/** @param {string} pkg package directory name; names its files in the shared cache @param {number} threshold minimum mutation score (percent) @param {number} [floor] temporary `break` below threshold (needs a TODO + backlog line) */
export function strykerConfig(pkg, threshold, floor = threshold) {
  return {
    mutate: ["src/**/*.ts", "!src/index.ts", "!src/types/**"],
    testRunner: "vitest",
    vitest: { configFile: VITEST },
    plugins: ["@stryker-mutator/vitest-runner", REPORTER],
    checkers: [],
    incremental: true,
    incrementalFile: path.join(mutateCacheDir(), `${pkg}.json`),
    tempDirName: ".stryker-tmp",
    reporters: ["json", "keel"],
    jsonReporter: { fileName: "reports/mutation/mutation.json" },
    thresholds: { high: 90, low: threshold, break: floor },
    logLevel: "fatal",
    fileLogLevel: "off",
    ignoreStatic: true,
  };
}
