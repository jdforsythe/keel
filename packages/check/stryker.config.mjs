import os from "node:os";
import { ROOT_SANDBOX, strykerConfig } from "../../tooling/stryker.mjs";

const base = strykerConfig("check", 70);

export default {
  ...base,
  ...ROOT_SANDBOX,
  // `KEEL_MUTATE_CONCURRENCY` when set (the base config carries it), else half the cores: the vitest runner is CPU-bound.
  concurrency: base.concurrency ?? Math.max(1, Math.floor(os.cpus().length / 2)),
  vitest: { configFile: "vitest.mutate.config.ts" },
  mutate: [
    ...base.mutate,
    // Pure data table (explanation prose): string-literal mutants there are not behaviour and only
    // cost run time. KERNEL_RULES.ts is mutated again (backlog 0098).
    "!src/internal/EXPLANATIONS.ts",
  ],
};
