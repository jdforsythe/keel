import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    setupFiles: ["test/support/warm.ts"],
    testTimeout: 15_000,
  },
});
