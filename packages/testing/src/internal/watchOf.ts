import type { Ctx } from "@keel/ctx";
import type { SettleWatch } from "./SettleWatch.ts";
import { harnessGauges } from "./harnessGauges.ts";

/**
 * How a harness `settle` on `ctx` tells the run it belongs to that a call is in progress, and when it waits on nothing
 * but an unanswered route (k.drive Driving). A ctx outside `simulate` reports nowhere and its clock stays the test's.
 */
export function watchOf(ctx: Ctx): SettleWatch {
  return (stalled) => {
    const gauge = harnessGauges.get(ctx.clock);
    if (gauge === undefined) return undefined;
    let ready: () => void = () => {};
    const done = new Promise<void>((resolve) => {
      ready = resolve;
    });
    const call = { stalled, ready: () => ready() };
    gauge.calls.add(call);
    return {
      ready: done,
      end: () => {
        gauge.calls.delete(call);
      },
    };
  };
}
