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
  },
});
