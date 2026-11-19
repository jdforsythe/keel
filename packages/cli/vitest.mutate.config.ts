// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package under the repository
// root's `.stryker-tmp` (stryker.config.mjs), so a test reaches `spec/`, `tooling/` and `packages/` as it does from the
// package. A test that reaches a sibling package finds the root with `repoRoot` (`@keel/tooling/repo-root`).
// Excluded here (still run by `pnpm test`): the tests that spawn `keel` from `packages/cli/src/bin.ts` or scan
// `packages/` and `apps/`. They run the package's own source, not the sandbox copy, so they can kill no mutant.
import { QuickFirst } from "@keel/tooling/quick-first";
import { defineConfig, mergeConfig } from "vitest/config";
import base from "./vitest.config.ts";

export default mergeConfig(
  base,
  defineConfig({
    test: {
      exclude: [
        "conformance/artifact-forged-e1005.test.ts",
        "conformance/artifact-routes-literals.test.ts",
        "conformance/artifact-tamper-e1005.test.ts",
        "conformance/check-budget-injected10.test.ts",
        "conformance/dev-port-0091.test.ts",
        "conformance/ledger-diff-e1706-cli.test.ts",
        "conformance/ledger-diff-e1707-cli.test.ts",
        "conformance/ledger-rung-promotion-cli.test.ts",
        "conformance/mcp-input-schema-equals-json-schema.test.ts",
        "conformance/module-std-deps-loaded.test.ts",
        "conformance/module-std-tools-loaded.test.ts",
        "conformance/test-sim-ctx.test.ts",
        "conformance/workspace-same-diagnostics.test.ts",
        "**/node_modules/**",
      ],
      sequence: { sequencer: QuickFirst },
    },
  }),
);
