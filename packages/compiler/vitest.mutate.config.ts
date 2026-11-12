// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package
// (.stryker-tmp/sandbox-*), where the repository root is not the sandbox's parent.
// Excluded here (still run by `pnpm test`):
// - clientBuild.test.ts "resolves the topology from the working directory": calls process.chdir(), which Stryker's vitest
//   worker threads do not support.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: ["**/node_modules/**"],
      testNamePattern: /^(?!.*resolves the topology from the working directory when the config has no root)/,
      sequence: { sequencer: QuickFirst },
    },
  }),
);
