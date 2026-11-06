import { defineConfig } from "vitest/config";

// A two-test project for `keel test` (test/vitest.test.ts). Its files end in .fixture.ts so the cli's own run skips them.
export default defineConfig({ test: { include: ["*.fixture.ts"] } });
