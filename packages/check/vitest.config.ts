import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // `check()` imports nothing and reads the schema registry as its process holds it; `keel check` imports each std package in `deps`
    // first (k.module Std config). A test process stands in for that import for the two packages whose formats E1108 fixtures name.
    setupFiles: ["@keel/std-temporal", "@keel/std-text"],
    // A test here builds a fresh TypeScript program per case, and a property test builds over a hundred; beside
    // every other package's tests on a busy machine one takes tens of seconds.
    testTimeout: 60_000,
  },
});
