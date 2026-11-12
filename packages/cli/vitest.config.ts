import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Tests here run the checker's type pass, a fresh TypeScript program per case, and the compat suites spawn several
    // builds per property run; on a busy machine one takes several seconds.
    testTimeout: 30_000,
  },
});
