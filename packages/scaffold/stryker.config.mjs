import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

// Scaffold-specific run tuning (backlog 0096); threshold and `break` stay at 70.
// - vitest.stryker.config.mjs runs the cheap example tests before the slow property/biome tests (bail kills early).
// - ROOT_SANDBOX puts the sandbox where the package sits, so `test/packCliDocs.ts` reaches `../../cli` (linked to `packages/cli`).
// - Property tests run fewer cases per mutant (RUNS in test/helpers.ts) and biome verdicts are cached (emitted-code test).
const base = strykerConfig("scaffold", 70);
export default { ...base, ...ROOT_SANDBOX, vitest: { configFile: "vitest.stryker.config.mjs" } };
