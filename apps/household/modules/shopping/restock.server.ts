import { workflow } from "@keel/std-workflows";
import { putBack } from "./putBack.server.ts";
import { restockChart } from "./restockChart.ts";

/**
 * The weekly run of the staples: one step job per staple (five attempts, ten seconds each, so a step a killed server
 * held runs again eleven seconds later), a two-second wait between them, and each run kept eight days
 * after it ends, so the setup page shows last week's until the next one starts.
 */
export const restock = workflow("shopping.restock", {
  chart: restockChart,
  steps: { putting: { run: putBack, done: "put", failed: "failed", attempts: 5, timeoutMs: 10_000 } },
  waits: { resting: { ms: 2_000, event: "rested" } },
  keepMs: 8 * 86_400_000,
});
