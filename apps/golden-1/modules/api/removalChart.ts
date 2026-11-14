import { s } from "@keel/schema";
import { chart } from "@keel/std-statecharts";
import { RemovalData } from "./RemovalData.schema.ts";
import { StepFailure } from "./StepFailure.schema.ts";

/**
 * A list removal (`removal`): `hidden` until it `expired` (600,000 ms, the wait) or someone sends `undo`; `purging`
 * deletes the list and its todos, `purged` ends it `removed`, `purgeFailed` compensates in `restoring`; `restoring`
 * shows the list again, `restored` ends it `kept`, `restoreFailed` ends it `stuck`.
 */
export const removalChart = chart("api.removalChart", {
  data: RemovalData,
  start: {},
  events: {
    expired: s.object({}),
    undo: s.object({}),
    purged: s.object({}),
    purgeFailed: StepFailure,
    restored: s.object({}),
    restoreFailed: StepFailure,
  },
  initial: "hidden",
  states: {
    hidden: { on: { expired: "purging", undo: "restoring" } },
    purging: { on: { purged: "removed", purgeFailed: "restoring" } },
    restoring: { on: { restored: "kept", restoreFailed: "stuck" } },
    removed: { final: true },
    kept: { final: true },
    stuck: { final: true },
  },
});
