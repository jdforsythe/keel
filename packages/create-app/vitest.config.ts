import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    // Each case runs the real bin as a child process, and the fresh-project cases then run `keel check`, `keel test`
    // and `keel build` over what it wrote, each a fresh TypeScript program on a shared machine.
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
