import os from "node:os";
import { strykerConfig } from "../../tooling/stryker.mjs";

const base = strykerConfig("check", 70);

export default {
  ...base,
  // Half the cores: the vitest runner is CPU-bound and the full run was ~18 minutes.
  concurrency: Math.max(1, Math.floor(os.cpus().length / 2)),
  // `incremental` and `ignoreStatic` are already on in the shared factory; keep them explicit here.
  vitest: { configFile: "vitest.mutate.config.ts" },
  incremental: true,
  ignoreStatic: true,
  mutate: [
    ...base.mutate,
    // Pure data table (explanation prose): string-literal mutants there are not behaviour and only
    // cost run time. KERNEL_RULES.ts is mutated again (backlog 0098).
    "!src/internal/EXPLANATIONS.ts",
  ],
};
