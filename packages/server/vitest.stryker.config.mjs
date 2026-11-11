// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package
// (.stryker-tmp/sandbox-*), where repo-relative paths such as packages/cli/src/bin.ts do not exist.
// Excluded here (still run by `pnpm test`):
// - conformance/build-assets.test.ts: spawns `keel build` (packages/cli/src/bin.ts, Vite) from the package root.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(base, defineConfig({ test: { exclude: ["conformance/build-assets.test.ts", "**/node_modules/**"], sequence: { sequencer: QuickFirst } } }));
