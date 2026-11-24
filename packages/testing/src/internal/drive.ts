import type { Ctx, Schedule, SimCtx } from "@keel/ctx";
import { observe } from "@keel/ctx";
import { driven, storageWrites } from "@keel/ctx/internal";
import { stores } from "@keel/store";
import type { DriveHandle } from "./DriveHandle.ts";
import type { HarnessGauge } from "./HarnessGauge.ts";
import { drained } from "./drained.ts";
import { fail } from "./fail.ts";
import { harnessGauges } from "./harnessGauges.ts";
import { runTracker } from "./runTracker.ts";
import { traceEvent } from "./traceEvent.ts";

/** The longest `run(ms)` (k.sim simulate). */
const MAX_RUN_MS = 600_000;

/** A pending `run(ms?)`: the latest time the drive may take, the time to end at (null for `run()`), and its resolver. */
interface Waiting {
  readonly bound: number;
  readonly until: number | null;
  readonly done: () => void;
}

/**
 * The drive of one `simulate` run (k.drive Driving): the scenario runs in the run's async context (`inRun`). On each
 * of its turns the drive delivers the oldest settled held work once no thread-pool request is pending (k.drive-law
 * Order); when nothing of the run is pending (no resource of the run other than a promise or one a garbage collection
 * destroys, no held work) it resolves the oldest harness call not stalled on `ctx.net`, else, while the scenario is
 * pending, moves the run's clock to the next moment (the earlier of the clock's next deadline and the schedule's next
 * offline edge). The bound is `horizon` ms past the run's start or, while a `run(ms)` waits, `t + ms`. Once the
 * scenario resolves (`outlived`) it moves no clock and resolves when nothing is pending. It draws no random and reads
 * no time but the real-time budget, which `deadline` (a `performance.now()` time) ends, naming what is in flight. A
 * stall fails `failure` with E1727 or E1728 (k.drive Stalls). With `record` the moments and the observer events of the
 * ctx and its replicas go to `trace`.
 */
export function drive(
  ctx: SimCtx,
  schedule: Schedule,
  horizon: number,
  record: boolean,
  deadline: number,
): DriveHandle {
  const start = ctx.clock.now();
  const edges = schedule.offline.flatMap((w) => [w.at, w.at + w.ms]);
  const gauge: HarnessGauge = { calls: new Set() };
  harnessGauges.set(ctx.clock, gauge);
  const waiting: Waiting[] = [];
  const trace: string[] = [];
  const note = (entry: Record<string, unknown>): void => {
    trace.push(JSON.stringify(entry));
  };
  /** The harness calls in progress that are not stalled on an unanswered `ctx.net` route, in start order. */
  const busyCalls = (): { readonly stalled: () => boolean; readonly ready: () => void }[] =>
    [...gauge.calls].filter((call) => !call.stalled());
  let over = false;
  /** Set once the scenario has resolved: the drive then waits for the run's work, moving no clock (k.drive Stalls). */
  let after = false;
  let quiet: () => void = () => {};
  let reject: (e: Error) => void = () => {};
  const failure = new Promise<never>((_, no) => {
    reject = no;
  });
  failure.catch(() => {});
  const tracker = runTracker((label) => {
    reject(fail("E1728", `held work waits on the sim clock: ${label}`, { label }));
  });
  const watch = (c: Ctx): void => {
    if (record) observe(c, (e) => note({ kind: "event", at: c.clock.now(), event: traceEvent(e) }));
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
    // Inside the run's context, so the waiters, offline-edge callbacks and observers it runs make work of the run.
    tracker.inRun(() => ctx.clock.advance(Math.max(0, at - ctx.clock.now())));
    if (record) note({ kind: "moment", at: ctx.clock.now() });
  };
  const loop = async (): Promise<void> => {
    while (!over) {
      await drained();
      if (over) return;
      if (performance.now() >= deadline) {
        const labels = [...tracker.pending().map((piece) => piece.label), ...busyCalls().map(() => "a harness call")];
        const list = labels.length === 0 ? "none" : labels.join(", ");
        const why = after ? `work outlived the scenario: ${list}` : `the budget ran out with work in flight: ${list}`;
        reject(fail("E1728", why, { labels, budget: true }));
        return;
      }
      const pending = tracker.pending();
      // Held work is delivered one piece a turn, in start order, once no thread-pool request is pending (k.drive-law Order).
      if (tracker.deliver(pending)) continue;
      if (pending.length > 0) continue;
      // Nothing of the run is pending but harness calls: the oldest one not stalled on a route resolves on this turn.
      const [call] = busyCalls();
      if (call !== undefined) {
        gauge.calls.delete(call);
        call.ready();
        continue;
      }
      if (after) {
        quiet();
        return;
      }
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
      const due = ctx.clock.next();
      const why =
        due === null
          ? "the scenario waits and nothing in the run is due"
          : `the scenario waits past the horizon: next deadline ${due} ms`;
      reject(fail("E1727", why, { next: due }));
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
    outlived: () => {
      after = true;
      return new Promise<void>((done) => {
        quiet = done;
      });
    },
    finish: () => {
      if (!record) return;
      for (const [key, value] of storageWrites(ctx.storage)) note({ kind: "storage", key, value });
      const live = [...stores()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
      // A log entry's `at` is its store's own stamp (by default a counter no restore resets), not the run's.
      for (const [id, st] of live) {
        const snap = st.snapshot({ meta: true });
        note({ kind: "store", id, value: { ...snap, log: snap.log.map(({ at: _at, ...rest }) => rest) } });
      }
    },
    stop: async () => {
      over = true;
      harnessGauges.delete(ctx.clock);
      driven.delete(ctx.clock);
      tracker.stop();
      await running;
    },
  };
}
