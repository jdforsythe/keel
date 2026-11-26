import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    globalSetup: ["test/packCliDocs.ts"],
    passWithNoTests: true,
    // Tests here run the checker's type pass, a fresh TypeScript program per case; on a busy machine one takes several
    // seconds, and the deploy-files conformance test spawns `keel check` six times (about 18 s on an idle machine).
    testTimeout: 120_000,
    // A `beforeAll` of the agent-files conformance tests runs `keel scaffold project` twice, about 1 s here; the bound is
    // 60 s, so a runner ten times slower (scale 0.1) still has 6 s for the pair.
    hookTimeout: 60_000,
  },
});
