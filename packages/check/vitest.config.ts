import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // `check()` imports nothing and reads the schema registry as its process holds it; `keel check` imports each std package in `deps`
    // first (k.module Std config). A test process stands in for that import for the two packages whose formats E1108 fixtures name.
    setupFiles: ["@keel/std-temporal", "@keel/std-text"],
    // A test here builds a fresh TypeScript program per case, and a property test builds over a hundred: about 1 s a
    // program alone, up to 3 s beside other work, so a property case takes up to a few seconds alone. The bound is
    // 180,000 ms, so a runner ten times slower (scale 0.1) still has 18 s for it.
    testTimeout: 180_000,
  },
});
