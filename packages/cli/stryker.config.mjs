import { strykerConfig } from "../../tooling/stryker.mjs";

// vitest.mutate.config.ts drops the tests that cannot run from the sandbox copy of the package.
export default { ...strykerConfig("cli", 70), vitest: { configFile: "vitest.mutate.config.ts" } };
