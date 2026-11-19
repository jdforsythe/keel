import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Tests here run the checker's type pass, a fresh TypeScript program per case; on a busy machine one takes several
    // seconds, and the deploy-files conformance test spawns `keel check` six times (about 18 s on an idle machine).
    testTimeout: 120_000,
  },
});
