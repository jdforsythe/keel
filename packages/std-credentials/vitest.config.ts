import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
    fileParallelism: false,
  },
});
