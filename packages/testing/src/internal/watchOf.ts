import type { Ctx } from "@keel/ctx";
import type { SettleWatch } from "./SettleWatch.ts";
import { harnessGauges } from "./harnessGauges.ts";

const NONE = { stalled: (_: boolean): void => {}, end: (): void => {} };

/**
 * How a harness `settle` on `ctx` tells the run it belongs to that a call is in progress or stalled on `ctx.net`
 * (k.sim Driving). A ctx outside `simulate` reports nowhere and its clock stays the test's.
 */
export function watchOf(ctx: Ctx): SettleWatch {
  return () => {
    const gauge = harnessGauges.get(ctx.clock);
    if (gauge === undefined) return NONE;
    let stalled = false;
    let over = false;
    gauge.active++;
    return {
      stalled: (on) => {
        if (over || on === stalled) return;
        stalled = on;
        gauge.stalled += on ? 1 : -1;
      },
      end: () => {
        if (over) return;
        over = true;
        gauge.active--;
        if (stalled) gauge.stalled--;
      },
    };
  };
}
