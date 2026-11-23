import { strykerConfig } from "../../tooling/stryker.mjs";

// vitest.stryker.config.mjs leaves out the six conformance property files that render an app per run, and adds the
// setup file that reaches a group user's worker thread. `related: false`: a run of some files (a shard, `mutate:stale`)
// still runs every test file in its dry run, since no import graph leads from a test to the worker's modules.
export default {
  ...strykerConfig("std-sessions", 70),
  vitest: { configFile: "vitest.stryker.config.mjs", related: false },
};
