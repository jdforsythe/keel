import keel from "@keel/compiler/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [keel()],
  test: { include: ["test/**/*.test.{ts,tsx}", "src/**/*.test.{ts,tsx}"], environment: "happy-dom" },
});
