// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package
// (.stryker-tmp/sandbox-*), where repo-relative paths such as packages/cli/src/bin.ts do not exist.
// Excluded here (still run by `pnpm test`):
// - conformance/build-assets.test.ts: spawns `keel build` (packages/cli/src/bin.ts, Vite) from the package root.
// - conformance/hosting-0087.test.ts, conformance/e1560-deploy-env.test.ts, conformance/topology-server-mjs.test.ts,
//   test/productionEntryBundle.test.ts: spawn `keel build` (packages/cli/src/bin.ts) of a fixture, directly or through
//   conformance/topology-build-fixture.ts.
// - test/inspectSingleDefinition.test.ts: scans packages/*/src, which the sandbox copy of one package does not contain.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: { exclude: [
        "conformance/build-assets.test.ts",
        "conformance/hosting-0087.test.ts",
        "conformance/e1560-deploy-env.test.ts",
        "conformance/topology-server-mjs.test.ts",
        "test/productionEntryBundle.test.ts",
        "test/inspectSingleDefinition.test.ts",
        "**/node_modules/**",
      ], sequence: { sequencer: QuickFirst } },
  }),
);
