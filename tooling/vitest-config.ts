// The one vitest config shape for every package, app and scaffolded project: the caller's config plus the Keel
// reporter, the hard watchdog setup file (watchdog.ts) first among setup files, and the timeouts the watchdog reads.
// Under happy-dom the fetch classes are Node's (node-fetch.mjs preloaded into each worker, node-fetch-setup.ts after
// the environment; k.mount Testing).
// With `KEEL_COVERAGE=1` (tooling/coverage.mjs) it also measures coverage (coverage-config.ts); without it, nothing
// about coverage is set. With `KEEL_FILE_TIMES=1` (CI's tooling/ci-shards.mjs) each test file prints one
// `file <path> <s>s` line as it ends, so a shard's log says how far a run got and what each file cost. With
// `KEEL_TEST_WORKERS=<n>` (root `pnpm test` sets it from the machine's load, tooling/test-slots.mjs) a run uses at
// most n workers, unless the config sets `maxWorkers` itself. A test that runs `properties` or `simulate` and declares
// no options is given a timeout for its runs (property-times.ts).
import { fileURLToPath } from "node:url";
import type { ViteUserConfig } from "vitest/config";
import type { TestModule } from "vitest/node";
import type { Reporter } from "vitest/reporters";
import { coverageOptions } from "./coverage-config.ts";
import { propertyTimesPlugin } from "./property-times.ts";
import { KeelReporter } from "./vitest-reporter.ts";

const WATCHDOG = fileURLToPath(new URL("./watchdog.ts", import.meta.url));
const NODE_FETCH = new URL("./node-fetch.mjs", import.meta.url).href;
const NODE_FETCH_SETUP = fileURLToPath(new URL("./node-fetch-setup.ts", import.meta.url));

/** One line per finished test file: its path and its seconds (setup, import and tests). */
const fileTimes: Reporter = {
  onTestModuleEnd(m: TestModule): void {
    const d = m.diagnostic();
    const s = (d.setupDuration + d.collectDuration + d.duration) / 1000;
    process.stdout.write(`file ${m.relativeModuleId} ${s.toFixed(1)}s\n`);
  },
};

/** `KEEL_TEST_WORKERS` as a positive integer, else undefined. */
function workersFromEnv(): number | undefined {
  const n = Number(process.env.KEEL_TEST_WORKERS);
  return Number.isInteger(n) && n > 0 ? n : undefined;
}

export function keelConfig(config: ViteUserConfig = {}): ViteUserConfig {
  const test = config.test ?? {};
  const workers = test.maxWorkers ?? workersFromEnv();
  const own = test.setupFiles ?? [];
  const testTimeout = test.testTimeout ?? 5000;
  return {
    ...config,
    plugins: [...(config.plugins ?? []), propertyTimesPlugin(testTimeout)],
    test: {
      ...test,
      ...(workers === undefined ? {} : { maxWorkers: workers }),
      setupFiles: [WATCHDOG, NODE_FETCH_SETUP, ...(typeof own === "string" ? [own] : own)],
      execArgv: ["--import", NODE_FETCH, ...(test.execArgv ?? [])],
      reporters: process.env.KEEL_FILE_TIMES === "1" ? [new KeelReporter(), fileTimes] : [new KeelReporter()],
      ...(process.env.KEEL_COVERAGE === "1" ? { coverage: coverageOptions(process.cwd()) } : {}),
      provide: {
        ...test.provide,
        keelWatchdog: { testTimeout, hookTimeout: test.hookTimeout ?? 10_000 },
      },
    },
  };
}
