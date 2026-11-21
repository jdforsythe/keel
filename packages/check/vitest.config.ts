import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // A test here builds a fresh TypeScript program per case, and a property test builds over a hundred; beside
    // every other package's tests on a busy machine one takes tens of seconds.
    testTimeout: 60_000,
  },
});
