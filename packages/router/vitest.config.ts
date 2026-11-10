import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    reporters: [new KeelReporter()],
    // A cold `import("@keel/router")` under the full parallel suite takes about 5 s (internal-subpath.test.ts).
    testTimeout: 15_000,
  },
});
