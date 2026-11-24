import type { Ctx, Schedule, SimCtx } from "@keel/ctx";
import { observe } from "@keel/ctx";
import { driven, heldWork } from "@keel/ctx/internal";
import type { DriveHandle } from "./DriveHandle.ts";
import type { HarnessGauge } from "./HarnessGauge.ts";
import { drained } from "./drained.ts";
import { fail } from "./fail.ts";
import { harnessGauges } from "./harnessGauges.ts";
import { runTracker } from "./runTracker.ts";
import { traceEvent } from "./traceEvent.ts";

/** Real milliseconds work may stay pending before E1728 (k.drive Stalls); it only fails a run. */
const PENDING_MS = 10_000;
/** The longest `run(ms)` (k.sim simulate). */
const MAX_RUN_MS = 600_000;

/** A pending `run(ms?)`: the latest time the drive may take, the time to end at (null for `run()`), and its resolver. */
interface Waiting {
  readonly bound: number;
  readonly until: number | null;
  readonly done: () => void;
}

/**
 * The drive of one `simulate` run (k.drive Driving): the scenario runs in the run's async context (`inRun`), and
 * while it is pending the drive moves the run's clock to the next moment (the earlier of the clock's next deadline and
 * the schedule's next offline edge) on each of its turns where nothing is pending: no resource of the run other than a
 * promise, no held work, no harness call in progress but one stalled on `ctx.net`. The bound is `horizon` ms past the
 * run's start or, while a `run(ms)` waits, `t + ms`. It draws no random and reads no time but the 10,000 ms bound on
 * pending work. A stall fails `failure` with E1727 or E1728 (k.drive Stalls). With `record` the moments and the
 * observer events of the ctx and its replicas go to `trace`.
 */
export function drive(ctx: SimCtx, schedule: Schedule, horizon: number, record: boolean): DriveHandle {
  const start = ctx.clock.now();
  const edges = schedule.offline.flatMap((w) => [w.at, w.at + w.ms]);
  const gauge: HarnessGauge = { calls: new Set() };
  harnessGauges.set(ctx.clock, gauge);
  const waiting: Waiting[] = [];
  const trace: string[] = [];
  const note = (entry: Record<string, unknown>): void => {
    trace.push(JSON.stringify({ at: ctx.clock.now(), ...entry }));
  };
  let over = false;
  let reject: (e: Error) => void = () => {};
  const failure = new Promise<never>((_, no) => {
    reject = no;
  });
  failure.catch(() => {});
  const tracker = runTracker((label) => {
    reject(fail("E1728", `held work waits on the sim clock: ${label}`, { label }));
  });
  const watch = (c: Ctx): void => {
    if (record) observe(c, (e) => note(traceEvent(e)));
  };
  driven.set(ctx.clock, { enter: tracker.enter, waited: tracker.waited, replica: watch });
  watch(ctx);
  /** The earlier of the clock's next deadline and the next offline window edge after the clock, or null. */
  const next = (): number | null => {
    const now = ctx.clock.now();
    return edges.reduce<number | null>((min, e) => (e > now && (min === null || e < min) ? e : min), ctx.clock.next());
  };
  /** The latest time the drive may move the clock to now: the longest `run(ms)` waiting, else the horizon. */
  const bound = (): number =>
    waiting.reduce((m, w) => Math.max(m, w.bound), waiting.length === 0 ? start + horizon : 0);
  const moveTo = (at: number): void => {
    ctx.clock.advance(Math.max(0, at - ctx.clock.now()));
    if (record) note({ kind: "moment" });
  };
  const loop = async (): Promise<void> => {
    let since: number | null = null;
    while (!over) {
      await drained();
      if (over) return;
      const held = heldWork(ctx);
      const live = tracker.pending();
      let stalled = 0;
      for (const call of gauge.calls) if (call.stalled()) stalled++;
      if (held.length > 0 || live.length > 0 || gauge.calls.size > stalled) {
        const now = performance.now();
        since ??= now;
        if (now - since > PENDING_MS) {
          const label = held[0] ?? live[0] ?? "a harness call";
          reject(fail("E1728", `work in flight never answered: ${label}`, { label }));
          return;
        }
        continue;
      }
      since = null;
      const at = next();
      if (at !== null && at <= bound()) {
        moveTo(at);
        continue;
      }
      if (waiting.length > 0) {
        for (const w of waiting.splice(0)) {
          if (w.until !== null && ctx.clock.now() < w.until) moveTo(w.until);
          w.done();
        }
        continue;
      }
      const deadline = ctx.clock.next();
      const why =
        deadline === null
          ? "the scenario waits and nothing in the run is due"
          : `the scenario waits past the horizon: next deadline ${deadline} ms`;
      reject(fail("E1727", why, { next: deadline }));
      return;
    }
  };
  const running = loop();
  const run = async (ms?: number): Promise<void> => {
    if (ms !== undefined && !(Number.isInteger(ms) && ms >= 0 && ms <= MAX_RUN_MS))
      throw fail(
        "schema.invalid",
        `simulate: run(ms) takes an integer from 0 to ${MAX_RUN_MS}, got ${String(ms)}`,
        null,
      );
    const t = ctx.clock.now();
    await new Promise<void>((done) => {
      waiting.push({
        bound: ms === undefined ? start + horizon : t + ms,
        until: ms === undefined ? null : t + ms,
        done,
      });
    });
  };
  return {
    inRun: tracker.inRun,
    run,
    failure,
    trace,
    stop: async () => {
      over = true;
      harnessGauges.delete(ctx.clock);
      driven.delete(ctx.clock);
      tracker.stop();
      await running;
    },
  };
}
