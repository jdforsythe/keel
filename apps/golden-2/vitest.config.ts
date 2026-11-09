import keel from "@keel/compiler/vite";
import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
    reporters: [new KeelReporter()],
  },
});
