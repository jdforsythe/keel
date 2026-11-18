import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// The sandbox sits under the repository root, so the tests that read it by a path relative to the test file find it.
// vitest.mutate.config.ts drops the tests that cannot run from the sandbox copy of the package.
export default { ...strykerConfig("compiler", 70), ...ROOT_SANDBOX, vitest: { configFile: "vitest.mutate.config.ts" } };
