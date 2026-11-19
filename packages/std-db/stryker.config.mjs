import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// The sandbox sits under the repository root, so the tests that reach `apps/` or a sibling package by a path relative
// to the test file find it.
export default { ...strykerConfig("std-db", 70), ...ROOT_SANDBOX };
