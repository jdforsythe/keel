import { NetStep, createCtx } from "@keel/ctx";
import { planSchemas } from "@keel/ctx/internal";
import { gen } from "@keel/schema/gen";
import { stores } from "@keel/store";
import * as fc from "fast-check";
import { SimRun } from "./SimRun.schema.ts";
import { clip } from "./internal/clip.ts";
import { drive } from "./internal/drive.ts";
import { fail } from "./internal/fail.ts";
import { firstLine } from "./internal/firstLine.ts";
import { seedFrom } from "./internal/seedFrom.ts";
import type { PropertyResult } from "./types/PropertyResult.ts";
import type { Scenario } from "./types/Scenario.ts";
import type { SimulateOptions } from "./types/SimulateOptions.ts";

/** Runs and horizon when the options leave them out (k.sim). */
const DEFAULT_RUNS = 100;
const HORIZON = 600_000;

/**
 * Run `scenario` under many generated schedules (k.sim), as `properties` runs a property under many inputs. Each run
 * draws a `SimRun` `{ seed, schedule }` (net steps, storage outcomes, offline windows inside the horizon, and a plan
 * for each capability registered with a `plan` schema), creates that sim ctx and awaits the scenario; the live stores
 * are restored to their snapshots from before `simulate` before each run and after the last. While the scenario is pending the run's clock is driven (k.sim): whenever the run is idle it moves to the earlier of
 * its next deadline and the next offline window edge, within the horizon. The scenario's `run()` waits to the horizon,
 * `run(ms)` to exactly `t + ms`; `horizon: 0` leaves the clock to the scenario. A scenario that waits on nothing the
 * run can move fails E1727, work in flight that never answers E1728. A failing run is shrunk
 * and thrown as E1704 with the seed and run on the first line and the shrunk `SimRun` as JSON on the next;
 * `{ replay }` runs one `SimRun` once. Success resolves `{ seed, runs }`.
 */
export async function simulate(scenario: Scenario, options: SimulateOptions = {}): Promise<PropertyResult> {
  const seed = seedFrom(options.seed);
  const horizon = options.horizon ?? HORIZON;
  const kept = [...stores().values()].map((st) => [st, st.snapshot({ meta: true })] as const);
  const restore = (): void => {
    for (const [st, snap] of kept) st.restore(snap);
  };
  const once = async (simRun: SimRun): Promise<void> => {
    restore();
    const ctx = createCtx({ mode: "sim", seed: simRun.seed, schedule: simRun.schedule });
    const driven = drive(ctx, simRun.schedule, horizon);
    const running = Promise.resolve(scenario({ ctx, seed: simRun.seed, schedule: simRun.schedule, run: driven.run }));
    // A stall fails the run while the scenario is still pending; its own later outcome is not read.
    running.catch(() => {});
    try {
      await Promise.race([running, driven.failure]);
    } finally {
      await driven.stop();
    }
  };
  const failed = (reason: unknown, run: number, label: string, simRun: SimRun | undefined): Error => {
    const plans = Object.keys(simRun?.schedule.plans ?? {});
    const named = plans.length === 0 ? "" : `, plans ${plans.join(", ")}`;
    const head = `simulate: ${clip(firstLine(reason), 70)} (seed ${seed}, run ${run}, ${label}${named})`;
    return fail("E1704", `${head}\n${JSON.stringify(simRun)}`, { seed, run, shrunk: simRun });
  };
  try {
    if (options.replay !== undefined) {
      const parsed = SimRun.parse(options.replay);
      if (!parsed.ok) throw fail("schema.invalid", `simulate: replay is not a SimRun: ${parsed.error.message}`, null);
      await once(parsed.value).catch((e: unknown) => {
        throw failed(e, 1, "replay", parsed.value);
      });
      return { seed, runs: 1 };
    }
    const runs = options.runs ?? DEFAULT_RUNS;
    // Sorted by name, so one seed draws the same runs whatever order the capabilities registered in.
    const plans = planSchemas().sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    const simRun: fc.Arbitrary<SimRun> = fc.record({
      seed: fc.integer({ min: 0, max: 2 ** 31 - 1 }),
      schedule: fc.record({
        net: fc.array(gen(NetStep)),
        storage: fc.array(fc.constantFrom<"ok" | "fail">("ok", "fail")),
        offline: fc.array(fc.record({ at: fc.nat(horizon), ms: fc.nat(horizon) })),
        plans: fc.record(
          Object.fromEntries(plans.map(([name, plan]) => [name, fc.array(gen(plan).map((v) => plan.encode(v)))])),
        ),
      }),
    });
    const out = await fc.check(
      fc.asyncProperty(simRun, async (r) => {
        await once(r);
      }),
      { seed, numRuns: runs },
    );
    if (out.failed) throw failed(out.errorInstance, out.numRuns, "shrunk", out.counterexample?.[0]);
    return { seed, runs };
  } finally {
    restore();
  }
}
