// Shared Stryker config factory. Per package: `export default strykerConfig("schema", 80);`.
// Thresholds come from docs/TESTING.md. Output follows docs/OUTPUT.md: one trailer line, NDJSON with KEEL_FORMAT=json.
import path from "node:path";
import { mutateCacheDir } from "./mutate-cache.ts";

export const REPORTER = path.join(import.meta.dirname, "stryker-reporter.mjs");
/** Vitest config for a package that has none of its own for mutation runs. */
export const VITEST = path.join(import.meta.dirname, "vitest.mutate.config.ts");

/**
 * Options for a package whose tests reach `spec/`, `tooling/`, `apps/` or a sibling package by a path relative to the
 * test file: the sandbox copy goes under the repository root's `.stryker-tmp`, two levels below the root as the package
 * is, so a path through the root ends where it does from the package. A path to a sibling (`../../<name>`) ends at
 * `.stryker-tmp/<name>`, which tooling/mutate.mjs links to `packages/<name>`. Spread after `strykerConfig(...)`.
 */
export const ROOT_SANDBOX = {
  tempDirName: path.join(import.meta.dirname, "..", ".stryker-tmp"),
  ignorePatterns: [".stryker-tmp"],
  // Stryker prefixes `../../` to a tsconfig `extends` that leaves the sandbox, as if the sandbox sat two levels below the
  // package. Here it sits as deep as the package, so the package's own `extends` already resolves: a tsconfig name that
  // names no file leaves it unrewritten.
  tsconfigFile: "tsconfig.stryker-keeps-paths.json",
};

/** Test runner processes per run, from `KEEL_MUTATE_CONCURRENCY`; unset leaves Stryker's own choice (one fewer than the cores). */
const CONCURRENCY = Number.parseInt(process.env.KEEL_MUTATE_CONCURRENCY ?? "", 10) || 0;

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
    ...(CONCURRENCY > 0 ? { concurrency: CONCURRENCY } : {}),
  };
}
