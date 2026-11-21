import { keelConfig } from "@keel/tooling/vitest-config";

export default keelConfig({
  test: {
    include: ["test/**/*.test.ts", "conformance/**/*.test.ts"],
    passWithNoTests: true,
    testTimeout: 60_000,
    // Files on the one server `KEEL_TEST_POSTGRES_URL` names share it, so they run one after another there.
    fileParallelism: (process.env.KEEL_TEST_POSTGRES_URL ?? "") === "",
  },
});
