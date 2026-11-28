import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// ROOT_SANDBOX: the conformance tests that run the `keel` binary find the repository at `../../..` from their file.
export default { ...strykerConfig("std-report", 70), ...ROOT_SANDBOX };
