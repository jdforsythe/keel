import type { Ctx } from "@keel/ctx";
import type { SettleWatch } from "./SettleWatch.ts";
import { harnessGauges } from "./harnessGauges.ts";

const NONE = { stalled: (_: (() => boolean) | null): void => {}, end: (): void => {} };

/**
 * How a harness `settle` on `ctx` tells the run it belongs to that a call is in progress, and when it waits on nothing
 * but an unanswered route (k.drive Driving). A ctx outside `simulate` reports nowhere and its clock stays the test's.
 */
export function watchOf(ctx: Ctx): SettleWatch {
  return () => {
    const gauge = harnessGauges.get(ctx.clock);
    if (gauge === undefined) return NONE;
    const call = { stalled: (): boolean => false };
    gauge.calls.add(call);
    return {
      stalled: (probe) => {
        call.stalled = probe ?? (() => false);
      },
      end: () => {
        gauge.calls.delete(call);
      },
    };
  };
}
