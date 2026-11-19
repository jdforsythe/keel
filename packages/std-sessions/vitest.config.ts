import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    exclude: ["**/node_modules/**", "conformance/.tmp-*/**", "conformance/fixtures/**"],
    globalSetup: ["test/removeFixtureArtifacts.ts"],
    passWithNoTests: true,
  },
});
