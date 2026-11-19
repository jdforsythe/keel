import { workflow } from "@keel/std-workflows";
import { purge } from "./purge.server.ts";
import { removalChart } from "./removalChart.ts";
import { restore } from "./restore.server.ts";

/**
 * The list removal workflow (std.workflows), store `api.removal`: `api.removeList` hides a list and starts an
 * instance; after 600,000 ms in `hidden` it purges the list (`purge`), and an undo, or a purge that failed 3 times,
 * shows it again (`restore`).
 */
export const removal = workflow("api.removal", {
  chart: removalChart,
  steps: {
    purging: { run: purge, done: "purged", failed: "purgeFailed" },
    restoring: { run: restore, done: "restored", failed: "restoreFailed" },
  },
  waits: { hidden: { ms: 600_000, event: "expired" } },
});
