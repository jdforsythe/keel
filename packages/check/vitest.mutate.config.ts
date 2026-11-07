import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

// Stryker runs tests from a sandbox copy of the package (.stryker-tmp/sandbox-*), where the repo-root `spec/`
// directory is not reachable. Tests that read spec/kernel/*.md check fixture/spec parity, not rule behaviour,
// so they are left to the normal `pnpm test` run (backlog 0080). fixture-per-code.test.ts no longer reads spec/
// (rfc:0065) and runs here; explain-and-fixture-per-code.test.ts reads spec/ and packages/*/conformance.
export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    exclude: ["conformance/explain-and-fixture-per-code.test.ts"],
    // Needs apps/golden-1 for the type pass via a relative path that does not exist from the sandbox.
    testNamePattern: /^(?!E1501: a string path passed to a navigate function typed)/,
    passWithNoTests: true,
    reporters: [new KeelReporter()],
  },
});
