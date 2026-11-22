import keel from "@keel/compiler/vite";
import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}", "modules/*/test/**/*.test.{ts,tsx}", ".keel/sessions/*.test.ts"],
    environment: "happy-dom",
  },
});
