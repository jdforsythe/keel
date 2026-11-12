// The one vitest config shape for every package, app and scaffolded project: the caller's config plus the Keel
// reporter, the hard watchdog setup file (watchdog.ts) first among setup files, and the timeouts the watchdog reads.
import { fileURLToPath } from "node:url";
import type { ViteUserConfig } from "vitest/config";
import { KeelReporter } from "./vitest-reporter.ts";

const WATCHDOG = fileURLToPath(new URL("./watchdog.ts", import.meta.url));

export function keelConfig(config: ViteUserConfig = {}): ViteUserConfig {
  const test = config.test ?? {};
  const own = test.setupFiles ?? [];
  return {
    ...config,
    test: {
      ...test,
      setupFiles: [WATCHDOG, ...(typeof own === "string" ? [own] : own)],
      reporters: [new KeelReporter()],
      provide: {
        ...test.provide,
        keelWatchdog: { testTimeout: test.testTimeout ?? 5000, hookTimeout: test.hookTimeout ?? 10_000 },
      },
    },
  };
}
