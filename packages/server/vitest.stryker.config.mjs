// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package
// (.stryker-tmp/sandbox-*), where repo-relative paths such as packages/cli/src/bin.ts do not exist.
// Excluded here (still run by `pnpm test`):
// - conformance/build-assets.test.ts: spawns `keel build` (packages/cli/src/bin.ts, Vite) from the package root.
// - conformance/hosting-0087.test.ts, conformance/e1560-deploy-env.test.ts, conformance/topology-server-mjs.test.ts,
//   test/productionEntryBundle.test.ts: spawn `keel build` (packages/cli/src/bin.ts) of a fixture, directly or through
//   conformance/topology-build-fixture.ts.
// - test/*.scale.test.ts: the log scrub on texts of 400,000 to 2,000,000 characters. Instrumented, those cases take
//   about 115 s of the dry run's 147 s of tests. Stryker gives a mutant 1.5 times its covering tests' time before a
//   timeout, and counts a loop as endless at 100 times the dry run's passes through it, so with them a scrub mutant
//   that loops without end costs over 200 s and one that survives over 100 s. The same bounds on small texts, and
//   the cap with a small cap, stay in (test/scrubSteps.test.ts, test/holdSecrets.test.ts).
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "conformance/build-assets.test.ts",
        "conformance/hosting-0087.test.ts",
        "conformance/e1560-deploy-env.test.ts",
        "conformance/topology-server-mjs.test.ts",
        "test/productionEntryBundle.test.ts",
        "test/*.scale.test.ts",
        "**/node_modules/**",
      ],
      sequence: { sequencer: QuickFirst },
      // The slowest test of the dry run takes 1.1 s instrumented, 2.7 s on a loaded machine; 10 s leaves room. A
      // mutant that leaves a test waiting fails it at this bound, well inside Stryker's own timeout.
      testTimeout: 10_000,
    },
  }),
);
