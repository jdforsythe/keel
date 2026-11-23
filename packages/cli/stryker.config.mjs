import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// vitest.mutate.config.ts drops the tests that spawn `keel` from the package's own source.
// `disableTypeChecks` names the mutated sources only (no type checker runs): by default Stryker also puts `// @ts-nocheck`
// at the top of every `.ts` file of the sandbox, which `conformance/unsafe/review-fixtures` hold as the source `keel review` reads.
export default {
  ...strykerConfig("cli", 70),
  ...ROOT_SANDBOX,
  disableTypeChecks: "src/**/*.ts",
  vitest: { configFile: "vitest.mutate.config.ts" },
};
