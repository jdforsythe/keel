import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";
import { BaseSequencer, type TestSpecification } from "vitest/node";

// Stryker runs tests from a sandbox copy of the package (.stryker-tmp/sandbox-*), where the repo-root `spec/`
// directory is not reachable. Tests that read spec/kernel/*.md check fixture/spec parity, not rule behaviour,
// so they are left to the normal `pnpm test` run: explain-and-fixture-per-code.test.ts reads spec/ and
// packages/*/conformance; explain.test.ts reads spec/kernel/ through conformance/spec-codes.ts.

// Stryker stops a mutant's run at the first failing test, and vitest's own order runs the slowest files first.
// The files that run a type pass over a whole module tree, or spawn the binary, go last, so a mutant that a
// quick test kills never pays for them.
const SLOW = /\/(module-[^/]*|check-json-byte-identical-binary|token-budget|deterministic)\.test\.ts$/;

class QuickFirst extends BaseSequencer {
  override async sort(files: TestSpecification[]): Promise<TestSpecification[]> {
    const rank = (f: TestSpecification): number => (SLOW.test(f.moduleId) ? 1 : 0);
    return [...files].sort((a, b) => rank(a) - rank(b) || a.moduleId.localeCompare(b.moduleId));
  }
}

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    exclude: ["conformance/explain-and-fixture-per-code.test.ts", "conformance/explain.test.ts"],
    // Needs apps/golden-1 for the type pass via a relative path that does not exist from the sandbox.
    testNamePattern: /^(?!E1501: a string path passed to a navigate function typed)/,
    passWithNoTests: true,
    sequence: { sequencer: QuickFirst },
    reporters: [new KeelReporter()],
  },
});
