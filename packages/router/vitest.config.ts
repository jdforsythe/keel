import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // A cold `import("@keel/router")` under the full parallel suite takes about 5 s (internal-subpath.test.ts).
    testTimeout: 15_000,
  },
});
