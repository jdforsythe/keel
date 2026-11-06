import { defineConfig } from "vitest/config";
import { KeelReporter } from "../../vitest-reporter.ts";

export default defineConfig({
  test: { include: ["*.fixture.ts"], reporters: [new KeelReporter()] },
});
