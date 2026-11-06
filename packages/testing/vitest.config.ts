import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    environment: "happy-dom",
    passWithNoTests: true,
    reporters: [new KeelReporter()],
  },
});
