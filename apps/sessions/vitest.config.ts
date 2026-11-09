import keel from "@keel/compiler/vite";
import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [keel()],
  test: {
    // `keel session` replays run as `.keel/sessions/*.test.ts` jobs; `to-test` writes `modules/<m>/test/`.
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
    reporters: [new KeelReporter()],
  },
});
