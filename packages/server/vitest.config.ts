import { KeelReporter } from "@keel/tooling/vitest-reporter";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    reporters: [new KeelReporter()],
    // Served documents name `/@keel/entry.ts`; parsing one must not fetch it (and print a stack) in the test window.
    environmentOptions: {
      happyDOM: {
        settings: {
          disableJavaScriptFileLoading: true,
          disableJavaScriptEvaluation: true,
          handleDisabledFileLoadingAsSuccess: true,
        },
      },
    },
  },
});
