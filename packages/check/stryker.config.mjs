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
    // cost run time. KERNEL_RULES.ts (an import list plus one array of rule objects, no logic) stays
    // excluded: a full-file run with it included did not finish inside the 15-minute budget (backlog 0080),
    // so no score >= 70% could be shown. Re-include it when a faster incremental run is available.
    "!src/internal/EXPLANATIONS.ts",
    "!src/internal/KERNEL_RULES.ts",
  ],
};
