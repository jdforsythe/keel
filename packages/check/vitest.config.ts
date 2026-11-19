import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // A test here builds a fresh TypeScript program per case; on a busy machine one takes several seconds.
    testTimeout: 15_000,
  },
});
