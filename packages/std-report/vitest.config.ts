import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Tests import `@keel/cli` and the tools entry inside the test body; under a whole-repo run that load exceeds 5 s.
    testTimeout: 30_000,
  },
});
