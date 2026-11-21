import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Tests here run the checker's type pass, a fresh TypeScript program per case, and the compat suites spawn several
    // builds per property run; on a busy machine one takes several seconds. The review conformance runs the `keel`
    // binary about 80 times in one test, each start near half a second.
    testTimeout: 120_000,
  },
});
