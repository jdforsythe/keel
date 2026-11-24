import { QuickFirst } from "@keel/tooling/quick-first";
import { keelConfig } from "@keel/tooling/vitest-config";

// Stryker runs tests from a sandbox copy of the package (.stryker-tmp/sandbox-*), where the repo-root `spec/`
// directory is not reachable. Tests that read spec/kernel/*.md check fixture/spec parity, not rule behaviour,
// so they are left to the normal `pnpm test` run: explain-and-fixture-per-code.test.ts reads spec/ and
// packages/*/conformance; explain.test.ts reads spec/kernel/ through conformance/spec-codes.ts.
// conformance/check-json-byte-identical-binary.test.ts spawns packages/cli/src/bin.ts by a repo-relative path.

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    exclude: [
      "conformance/explain-and-fixture-per-code.test.ts",
      "conformance/explain.test.ts",
      "conformance/check-json-byte-identical-binary.test.ts",
    ],
    // A conformance file reaches apps/golden-1 by a path relative to the file, which does not exist from the sandbox,
    // and conformance is not edited: E1501.
    testNamePattern: /^(?!E1501: a string path passed to a navigate function typed)/,
    passWithNoTests: true,
    // `check()` imports nothing and reads the schema registry as its process holds it; `keel check` imports each std package in `deps`
    // first (k.module Std config). A test process stands in for that import for the two packages whose formats E1108 fixtures name.
    setupFiles: ["@keel/std-temporal", "@keel/std-text"],
    sequence: { sequencer: QuickFirst },
  },
});
