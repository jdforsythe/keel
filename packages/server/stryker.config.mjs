import { strykerConfig } from "../../tooling/stryker.mjs";

// vitest.stryker.config.mjs drops the one test that spawns `keel build` from a repo-relative path.
const base = strykerConfig("server", 70);
// A mutant in the log scrub can allocate without end (its loops fill arrays): each test runner process has a 1.5 GB
// heap, so such a mutant ends as an out-of-memory error in seconds and Stryker restarts the process.
export default {
  ...base,
  vitest: { configFile: "vitest.stryker.config.mjs" },
  testRunnerNodeArgs: ["--max-old-space-size=1536"],
};
