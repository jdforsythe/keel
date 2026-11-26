import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
    // A hook that calls `ready()` loads the PGlite engine (its WebAssembly and initdb): about 1.5 s here, over 10 s on a
    // slow runner. The bound is 60,000 ms, the bound the apps give a PGlite folder's first open.
    hookTimeout: 60_000,
    // Files on the one server `KEEL_TEST_POSTGRES_URL` names share it, so they run one after another there.
    fileParallelism: (process.env.KEEL_TEST_POSTGRES_URL ?? "") === "",
  },
});
