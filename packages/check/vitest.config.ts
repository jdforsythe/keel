import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // A test here builds a fresh TypeScript program per case; on a busy machine one takes several seconds.
    testTimeout: 15_000,
    reporters: [new KeelReporter()],
  },
});
