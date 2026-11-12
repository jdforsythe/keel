// Vitest config used only by `pnpm mutate`. Stryker runs tests from a sandbox copy of the package
// (.stryker-tmp/sandbox-*), where repo-relative paths such as packages/cli/src/bin.ts, spec/ and apps/ do not exist.
// Excluded here (still run by `pnpm test`):
// - artifact-forged-e1005, artifact-routes-literals, artifact-tamper-e1005, check-budget-injected10,
//   mcp-input-schema-equals-json-schema, test-sim-ctx, and the cli cases in ledger-diff-e1706-cli, ledger-diff-e1707-cli,
//   ledger-rung-promotion-cli, module-std-deps-loaded, module-std-tools-loaded, workspace-same-diagnostics: spawn
//   `keel` (packages/cli/src/bin.ts) over a project by a repo-relative path, or scan packages/ and apps/.
// - conformance/spec-and-explain.test.ts: reads spec/kernel/k.cli.md.
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
        "conformance/ledger-diff-e1706-cli.test.ts",
        "conformance/ledger-diff-e1707-cli.test.ts",
        "conformance/ledger-rung-promotion-cli.test.ts",
        "conformance/mcp-input-schema-equals-json-schema.test.ts",
        "conformance/module-std-deps-loaded.test.ts",
        "conformance/module-std-tools-loaded.test.ts",
        "conformance/spec-and-explain.test.ts",
        "conformance/test-sim-ctx.test.ts",
        "conformance/workspace-same-diagnostics.test.ts",
        "**/node_modules/**",
      ],
      sequence: { sequencer: QuickFirst },
    },
  }),
);
