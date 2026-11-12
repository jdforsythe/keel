// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package
// (.stryker-tmp/sandbox-*), where sibling packages and the repo-root docs/ do not exist.
// Excluded here (still run by `pnpm test`):
// - test/className.test.ts, test/mutation-styles-units.test.ts: import ../../ui/src/.
// - test/url-agreement.test.ts: imports ../../runtime-dom/test/urlCases.ts.
// - clientBuild.test.ts "resolves the topology from the working directory": calls process.chdir(), which Stryker's vitest
//   worker threads do not support.
// - hosting.test.ts "the mark is the brand mark": reads docs/brand/keel-mark.svg.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "test/className.test.ts",
        "test/mutation-styles-units.test.ts",
        "test/url-agreement.test.ts",
        "**/node_modules/**",
      ],
      testNamePattern: /^(?!.*(?:the mark is the brand mark|resolves the topology from the working directory when the config has no root))/,
      sequence: { sequencer: QuickFirst },
    },
  }),
);
