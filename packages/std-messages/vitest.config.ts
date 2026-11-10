import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Importing @keel/check (typescript, the compiler) cold takes several seconds; the build test runs `keel build`.
    testTimeout: 30_000,
    reporters: [new KeelReporter()],
  },
});
