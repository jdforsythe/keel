import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// vitest.mutate.config.ts drops the tests that spawn `keel` from the package's own source.
export default { ...strykerConfig("cli", 70), ...ROOT_SANDBOX, vitest: { configFile: "vitest.mutate.config.ts" } };
