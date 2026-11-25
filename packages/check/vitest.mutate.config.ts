import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

// Vitest config used only by `pnpm mutate`: the package's own config (its tests, setup files and timeout), less what
// cannot run from Stryker's sandbox copy of the package (.stryker-tmp/sandbox-*), where the repo-root `spec/`
// directory is not reachable. Tests that read spec/kernel/*.md check fixture/spec parity, not rule behaviour,
// so they are left to the normal `pnpm test` run: explain-and-fixture-per-code.test.ts reads spec/ and
// packages/*/conformance; explain.test.ts reads spec/kernel/ through conformance/spec-codes.ts.
// conformance/check-json-byte-identical-binary.test.ts spawns packages/cli/src/bin.ts by a repo-relative path.

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "conformance/explain-and-fixture-per-code.test.ts",
        "conformance/explain.test.ts",
        "conformance/check-json-byte-identical-binary.test.ts",
        "**/node_modules/**",
      ],
      // A conformance file reaches apps/golden-1 by a path relative to the file, which does not exist from the sandbox,
      // and conformance is not edited: E1501.
      testNamePattern: /^(?!E1501: a string path passed to a navigate function typed)/,
      sequence: { sequencer: QuickFirst },
    },
  }),
);
