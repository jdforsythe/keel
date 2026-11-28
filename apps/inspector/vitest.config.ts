import keel from "@keel/compiler/vite";
import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  plugins: [keel()],
  test: {
    include: ["test/**/*.test.{ts,tsx}"],
    environment: "happy-dom",
    // The component properties render whole views many times; on a slow machine one takes more than the 5 s default.
    testTimeout: 20_000,
  },
});
