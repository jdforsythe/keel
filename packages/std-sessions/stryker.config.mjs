import { strykerConfig } from "../../tooling/stryker.mjs";

// vitest.stryker.config.mjs leaves out the six conformance property files that render an app per run.
export default { ...strykerConfig("std-sessions", 70), vitest: { configFile: "vitest.stryker.config.mjs" } };
