import { strykerConfig } from "../../tooling/stryker.mjs";

// vitest.stryker.config.mjs leaves out the six conformance property files that render an app per run, and adds the
// setup file that credits a test/unit/ file with what its imports do at load.
export default { ...strykerConfig("std-sessions", 70), vitest: { configFile: "vitest.stryker.config.mjs" } };
