import { defineConfig } from "vitest/config";
import { KeelReporter } from "./vitest-reporter.ts";

export default defineConfig({
  test: { include: ["test/**/*.test.ts"], reporters: [new KeelReporter()] },
});
