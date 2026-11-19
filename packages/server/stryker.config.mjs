import { strykerConfig } from "../../tooling/stryker.mjs";

// vitest.stryker.config.mjs drops the one test that spawns `keel build` from a repo-relative path.
const base = strykerConfig("server", 70);
export default { ...base, vitest: { configFile: "vitest.stryker.config.mjs" } };
