import keel from "@keel/compiler/vite";
import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
    setupFiles: ["test/setup.ts"],
    // The sign-in library's fixed test secret and in-memory database (authSettings).
    env: { AUTH_FIXTURE: "test" },
    // A page test seeds the api, renders the page and checks it with axe-core, token contrast and focus order: 0.2 to
    // 0.7 s beside the other workers on a quiet 4-core machine, and past the 5 s default on a runner an eighth as fast.
    testTimeout: 20_000,
  },
});
