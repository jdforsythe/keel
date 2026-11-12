import { QuickFirst } from "@keel/tooling/quick-first";
import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

// Stryker runs tests from a sandbox copy of the package (.stryker-tmp/sandbox-*), where the repo-root `spec/`
// directory is not reachable. Tests that read spec/kernel/*.md check fixture/spec parity, not rule behaviour,
// so they are left to the normal `pnpm test` run: explain-and-fixture-per-code.test.ts reads spec/ and
// packages/*/conformance; explain.test.ts reads spec/kernel/ through conformance/spec-codes.ts.
// conformance/check-json-byte-identical-binary.test.ts spawns packages/cli/src/bin.ts by a repo-relative path.

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    exclude: [
      "conformance/explain-and-fixture-per-code.test.ts",
      "conformance/explain.test.ts",
      "conformance/check-json-byte-identical-binary.test.ts",
    ],
    // Need a sibling package or apps/golden-1 for the type pass via a relative path that does not exist from the sandbox:
    // E1501 (apps/golden-1), E1510 (`../../router/`, `../ui/`: `@keel/router` is TS2307 from the sandbox).
    testNamePattern:
      /^(?!E1501: a string path passed to a navigate function typed|E1510: its fixture triggers|E1510 and E1508 from the type check)/,
    passWithNoTests: true,
    sequence: { sequencer: QuickFirst },
    reporters: [new KeelReporter()],
  },
});
