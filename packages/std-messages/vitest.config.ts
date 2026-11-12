import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Importing @keel/check (typescript, the compiler) cold takes several seconds; the build test runs `keel build`.
    testTimeout: 30_000,
  },
});
