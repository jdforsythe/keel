// The one vitest config shape for every package, app and scaffolded project: the caller's config plus the Keel
// reporter, the hard watchdog setup file (watchdog.ts) first among setup files, and the timeouts the watchdog reads.
// Under happy-dom the fetch classes are Node's (node-fetch.mjs preloaded into each worker, node-fetch-setup.ts after
// the environment; k.mount Testing).
// With `KEEL_COVERAGE=1` (tooling/coverage.mjs) it also measures coverage (coverage-config.ts); without it, nothing
// about coverage is set. With `KEEL_FILE_TIMES=1` (CI's tooling/ci-shards.mjs) each test file prints one
// `file <path> <s>s` line as it ends, so a shard's log says how far a run got and what each file cost. With
// `KEEL_TEST_WORKERS=<n>` (root `pnpm test` sets it from the machine's load, tooling/test-slots.mjs) a run uses at
// most n workers, unless the config sets `maxWorkers` itself; without it, a run sizes itself the same way as one task
// of `testSlots` from the load when it starts, at most vitest's own default (one fewer than the cores). A test that runs `properties` or `simulate` and declares
// no options is given a timeout for its runs (property-times.ts). In a Keel project (a `topology.ts` in the working
// directory) a run outside `keel test` gets what `keel test` gives it: `KEEL_TEST=1` and `@keel/testing/setup`, so a
// harness render given no `artifacts` takes the project's `.keel/a11y.json` and `tokens.ts` (k.a11y Artifacts).
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import os from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import type { ViteUserConfig } from "vitest/config";
import type { TestModule } from "vitest/node";
import type { Reporter } from "vitest/reporters";
import { coverageOptions } from "./coverage-config.ts";
import { propertyTimesPlugin } from "./property-times.ts";
import { testSlots } from "./test-slots.mjs";
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

/**
 * `KEEL_TEST_WORKERS` as a positive integer; else, for a run of its own (a package's `pnpm test`), the workers one
 * `testSlots` task gets from the load now, at most one fewer than the cores; else undefined (four cores or fewer).
 */
function workersFromEnv(): number | undefined {
  const n = Number(process.env.KEEL_TEST_WORKERS);
  if (Number.isInteger(n) && n > 0) return n;
  const cores = os.availableParallelism();
  const own = testSlots({ cores, load: os.loadavg()[0] ?? 0, env: { KEEL_TEST_TASKS: "1" } }).workers;
  return own === undefined ? undefined : Math.min(cores - 1, own);
}

/**
 * For a run in a Keel project that `keel test` did not start (it adds these itself): `KEEL_TEST=1` and the project's
 * `@keel/testing/setup`; else nothing.
 */
function asKeelTest(): { env: Record<string, string>; setup: string[] } {
  const cwd = process.cwd();
  if (process.env.KEEL_TEST === "1" || !existsSync(join(cwd, "topology.ts"))) return { env: {}, setup: [] };
  try {
    return {
      env: { KEEL_TEST: "1" },
      setup: [createRequire(join(cwd, "package.json")).resolve("@keel/testing/setup")],
    };
  } catch {
    return { env: {}, setup: [] };
  }
}

export function keelConfig(config: ViteUserConfig = {}): ViteUserConfig {
  const test = config.test ?? {};
  const workers = test.maxWorkers ?? workersFromEnv();
  const own = test.setupFiles ?? [];
  const testTimeout = test.testTimeout ?? 5000;
  const keelTest = asKeelTest();
  return {
    ...config,
    plugins: [...(config.plugins ?? []), propertyTimesPlugin(testTimeout)],
    test: {
      ...test,
      ...(workers === undefined ? {} : { maxWorkers: workers }),
      setupFiles: [WATCHDOG, NODE_FETCH_SETUP, ...(typeof own === "string" ? [own] : own), ...keelTest.setup],
      env: { ...keelTest.env, ...test.env },
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
