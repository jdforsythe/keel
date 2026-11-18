// The one vitest config shape for every package, app and scaffolded project: the caller's config plus the Keel
// reporter, the hard watchdog setup file (watchdog.ts) first among setup files, and the timeouts the watchdog reads.
// With `KEEL_COVERAGE=1` (tooling/coverage.mjs) it also measures coverage (coverage-config.ts); without it, nothing
// about coverage is set. With `KEEL_FILE_TIMES=1` (CI's tooling/ci-shards.mjs) each test file prints one
// `file <path> <s>s` line as it ends, so a shard's log says how far a run got and what each file cost.
import { fileURLToPath } from "node:url";
import type { ViteUserConfig } from "vitest/config";
import type { TestModule } from "vitest/node";
import type { Reporter } from "vitest/reporters";
import { coverageOptions } from "./coverage-config.ts";
import { KeelReporter } from "./vitest-reporter.ts";

const WATCHDOG = fileURLToPath(new URL("./watchdog.ts", import.meta.url));

/** One line per finished test file: its path and its seconds (setup, import and tests). */
const fileTimes: Reporter = {
  onTestModuleEnd(m: TestModule): void {
    const d = m.diagnostic();
    const s = (d.setupDuration + d.collectDuration + d.duration) / 1000;
    process.stdout.write(`file ${m.relativeModuleId} ${s.toFixed(1)}s\n`);
  },
};

export function keelConfig(config: ViteUserConfig = {}): ViteUserConfig {
  const test = config.test ?? {};
  const own = test.setupFiles ?? [];
  return {
    ...config,
    test: {
      ...test,
      setupFiles: [WATCHDOG, ...(typeof own === "string" ? [own] : own)],
      reporters: process.env.KEEL_FILE_TIMES === "1" ? [new KeelReporter(), fileTimes] : [new KeelReporter()],
      ...(process.env.KEEL_COVERAGE === "1" ? { coverage: coverageOptions(process.cwd()) } : {}),
      provide: {
        ...test.provide,
        keelWatchdog: { testTimeout: test.testTimeout ?? 5000, hookTimeout: test.hookTimeout ?? 10_000 },
      },
    },
  };
}
