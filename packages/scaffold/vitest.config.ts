import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Tests here run the checker's type pass, a fresh TypeScript program per case; on a busy machine one takes several
    // seconds, and the deploy-files conformance test spawns `keel check` six times (about 18 s on an idle machine).
    testTimeout: 120_000,
    reporters: [new KeelReporter()],
  },
});
