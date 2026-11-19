import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// The sandbox sits under the repository root, so the tests that import a sibling package by a path relative to the test
// file find it. vitest.stryker.config.mjs drops the tests that spawn `keel build`.
const base = strykerConfig("server", 70);
// A mutant in the log scrub can allocate without end (its loops fill arrays): each test runner process has a 1.5 GB
// heap, so such a mutant ends as an out-of-memory error in seconds and Stryker restarts the process.
export default {
  ...base,
  ...ROOT_SANDBOX,
  vitest: { configFile: "vitest.stryker.config.mjs" },
  testRunnerNodeArgs: ["--max-old-space-size=1536"],
};
