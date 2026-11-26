import keel from "@keel/compiler/vite";
import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
    setupFiles: ["test/setup.ts"],
    // The sign-in library's fixed test secret and in-memory database (modules/members/authSettings.server.ts).
    env: { AUTH_FIXTURE: "test" },
    // A page test seeds the app, renders the page and fires its controls (about 30 ms each): 0.15 to 0.6 s beside the
    // other workers on a quiet machine, and past the 5 s default on a runner an eighth as fast.
    testTimeout: 20_000,
  },
});
