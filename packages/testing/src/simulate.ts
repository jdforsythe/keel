import { NetStep, createCtx } from "@keel/ctx";
import { planSchemas } from "@keel/ctx/internal";
import { gen } from "@keel/schema/gen";
import { stores } from "@keel/store";
import * as fc from "fast-check";
import { SimRun } from "./SimRun.schema.ts";
import { clip } from "./internal/clip.ts";
import { codeOf } from "./internal/codeOf.ts";
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
 * for each capability registered with a `plan` schema), creates that sim ctx and awaits the scenario in the run's async
 * context; the live stores are restored to their snapshots from before `simulate` before each run and after the last.
 * While the scenario is pending the run's clock is driven (k.drive): on each turn where no work of the run is pending it
 * moves to the earlier of its next deadline and the next offline window edge, within the horizon. The scenario's
 * `run()` waits to the horizon, `run(ms)` to exactly `t + ms`; `horizon: 0` leaves the clock to the scenario. A
 * scenario that waits on nothing the run can move fails E1727, work in flight that never answers E1728. With `law` each
 * run is run twice and the traces compared; a failing run is replayed twice before it is reported; traces that differ
 * are E1729. A failing run is shrunk and thrown as E1704 with the seed and run on the first line and the shrunk
 * `SimRun` as JSON on the next; `{ replay }` runs one `SimRun` once. Success resolves `{ seed, runs }`.
 */
export async function simulate(scenario: Scenario, options: SimulateOptions = {}): Promise<PropertyResult> {
  const seed = seedFrom(options.seed);
  const horizon = options.horizon ?? HORIZON;
  const law = options.law ?? false;
  const kept = [...stores().values()].map((st) => [st, st.snapshot({ meta: true })] as const);
  const restore = (): void => {
    for (const [st, snap] of kept) st.restore(snap);
  };
  /** One run of `simRun`: what it failed with, if it did, and its trace when `record`. */
  const attempt = async (simRun: SimRun, record: boolean): Promise<{ error?: unknown; trace: readonly string[] }> => {
    restore();
    const ctx = createCtx({ mode: "sim", seed: simRun.seed, schedule: simRun.schedule });
    const driven = drive(ctx, simRun.schedule, horizon, record);
    const running = driven.inRun(async () =>
      scenario({ ctx, seed: simRun.seed, schedule: simRun.schedule, run: driven.run }),
    );
    // A stall fails the run while the scenario is still pending; its own later outcome is not read.
    running.catch(() => {});
    try {
      await Promise.race([running, driven.failure]);
      const left = await driven.outlived();
      if (left !== undefined)
        return {
          error: fail("E1728", `work outlived the scenario: ${left}`, { label: left }),
          trace: driven.trace,
        };
      return { trace: driven.trace };
    } catch (error) {
      return { error, trace: driven.trace };
    } finally {
      driven.finish();
      await driven.stop();
    }
  };
  /** E1729 when the traces differ (k.drive Law check), naming the first entry that does. */
  const compared = (a: readonly string[], b: readonly string[]): Error | undefined => {
    const n = Math.max(a.length, b.length);
    for (let i = 0; i < n; i++)
      if (a[i] !== b[i])
        return fail(
          "E1729",
          `two replays of the run differ at trace entry ${i}\n${a[i] ?? "null"}\n${b[i] ?? "null"}`,
          {
            entry: i,
          },
        );
    return undefined;
  };
  /** The first difference between two replays: the run has drifted, so there is nothing to shrink (k.drive Law check). */
  let drifted: Error | undefined;
  const once = async (simRun: SimRun): Promise<void> => {
    if (drifted !== undefined) return;
    const first = await attempt(simRun, law);
    if (law) {
      const second = await attempt(simRun, true);
      const differ = compared(first.trace, second.trace);
      if (differ !== undefined) {
        drifted = differ;
        throw differ;
      }
    }
    if (first.error !== undefined) throw first.error;
  };
  const failed = async (reason: unknown, run: number, label: string, simRun: SimRun | undefined): Promise<Error> => {
    if (codeOf(reason) === "E1729" && reason instanceof Error) return reason;
    // A failing run is replayed twice, its traces compared, unless it stalled (k.drive Law check).
    if (simRun !== undefined && codeOf(reason) !== "E1727" && codeOf(reason) !== "E1728") {
      const one = await attempt(simRun, true);
      const two = await attempt(simRun, true);
      const differ = compared(one.trace, two.trace);
      if (differ !== undefined) return differ;
    }
    const plans = Object.keys(simRun?.schedule.plans ?? {});
    const named = plans.length === 0 ? "" : `, plans ${plans.join(", ")}`;
    const head = `simulate: ${clip(firstLine(reason), 70)} (seed ${seed}, run ${run}, ${label}${named})`;
    return fail("E1704", `${head}\n${JSON.stringify(simRun)}`, { seed, run, shrunk: simRun });
  };
  try {
    if (options.replay !== undefined) {
      const parsed = SimRun.parse(options.replay);
      if (!parsed.ok) throw fail("schema.invalid", `simulate: replay is not a SimRun: ${parsed.error.message}`, null);
      try {
        await once(parsed.value);
      } catch (e) {
        throw await failed(e, 1, "replay", parsed.value);
      }
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
    if (drifted !== undefined) throw drifted;
    if (out.failed) throw await failed(out.errorInstance, out.numRuns, "shrunk", out.counterexample?.[0]);
    return { seed, runs };
  } finally {
    restore();
  }
}
