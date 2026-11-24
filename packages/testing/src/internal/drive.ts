import type { Schedule, SimCtx } from "@keel/ctx";
import { heldWork, netInFlight } from "@keel/ctx/internal";
import { stores } from "@keel/store";
import type { DriveHandle } from "./DriveHandle.ts";
import type { HarnessGauge } from "./HarnessGauge.ts";
import { drained } from "./drained.ts";
import { fail } from "./fail.ts";
import { harnessGauges } from "./harnessGauges.ts";

/** Macrotask turns a stalled run waits, with nothing due, before E1727: lets an untracked `import()` finish. */
const IDLE_TURNS = 1_000;
/** Macrotask turns held work or an unanswered route may wait, with nothing changing, before E1728 (`settle`'s count). */
const STUCK_TURNS = 200_000;
/** Consecutive quiet macrotask turns that make the run idle (k.sim Driving). */
const QUIET_TURNS = 2;
/** The longest `run(ms)` (k.sim simulate). */
const MAX_RUN_MS = 600_000;

/** A pending `run(ms?)`: the latest time the drive may take, the time to end at (null for `run()`), and its resolver. */
interface Waiting {
  readonly bound: number;
  readonly until: number | null;
  readonly done: () => void;
}

const logSizes = (): string => [...stores()].map(([id, st]) => `${id}:${st.log().length}`).join(",");

/**
 * The drive of one `simulate` run (k.sim Driving): while the scenario is pending it moves the run's clock to the next
 * moment (the earlier of the clock's next deadline and the schedule's next offline edge) whenever the run is idle, up
 * to `horizon` ms past the run's start or, while a `run(ms)` waits, `t + ms`. It draws no random and reads no real
 * time: idleness is two drained macrotask turns with no store-log or DOM change, no held work and no harness call in
 * progress but one stalled on `ctx.net`. A stall fails `failure` with E1727 or E1728 (k.sim Stalls).
 */
export function drive(ctx: SimCtx, schedule: Schedule, horizon: number): DriveHandle {
  const start = ctx.clock.now();
  const edges = schedule.offline.flatMap((w) => [w.at, w.at + w.ms]);
  const gauge: HarnessGauge = { active: 0, stalled: 0 };
  harnessGauges.set(ctx.clock, gauge);
  const waiting: Waiting[] = [];
  let over = false;
  let reject: (e: Error) => void = () => {};
  const failure = new Promise<never>((_, no) => {
    reject = no;
  });
  failure.catch(() => {});
  let mutations = 0;
  const observer =
    typeof MutationObserver === "function" && globalThis.document?.documentElement !== undefined
      ? new MutationObserver((records) => {
          mutations += records.length;
        })
      : undefined;
  observer?.observe(globalThis.document.documentElement, {
    subtree: true,
    childList: true,
    attributes: true,
    characterData: true,
  });
  const signature = (): string => {
    mutations += observer?.takeRecords().length ?? 0;
    return `${mutations}|${logSizes()}`;
  };
  /** The earlier of the clock's next deadline and the next offline window edge after the clock, or null. */
  const next = (): number | null => {
    const now = ctx.clock.now();
    return edges.reduce<number | null>((min, e) => (e > now && (min === null || e < min) ? e : min), ctx.clock.next());
  };
  /** The latest time the drive may move the clock to now: the longest `run(ms)` waiting, else the horizon. */
  const bound = (): number =>
    waiting.reduce((m, w) => Math.max(m, w.bound), waiting.length === 0 ? start + horizon : 0);
  const loop = async (): Promise<void> => {
    let last = signature();
    let quiet = 0;
    let still = 0;
    let idle = 0;
    while (!over) {
      await drained();
      if (over) return;
      const seen = signature();
      if (seen !== last) {
        last = seen;
        quiet = 0;
        still = 0;
        idle = 0;
        continue;
      }
      still++;
      const held = heldWork(ctx);
      if (held.length > 0 || gauge.active !== gauge.stalled) {
        quiet = 0;
        idle = 0;
        const [first] = held;
        if (first !== undefined && still > STUCK_TURNS) {
          reject(fail("E1728", `work in flight never answered: ${first}`, { label: first }));
          return;
        }
        continue;
      }
      if (++quiet < QUIET_TURNS) continue;
      const at = next();
      if (at !== null && at <= bound()) {
        ctx.clock.advance(Math.max(0, at - ctx.clock.now()));
        quiet = 0;
        still = 0;
        idle = 0;
        continue;
      }
      if (netInFlight(ctx.net) > 0) {
        idle = 0;
        if (still > STUCK_TURNS) {
          reject(fail("E1728", "work in flight never answered: a ctx.net request", { label: "a ctx.net request" }));
          return;
        }
        continue;
      }
      if (waiting.length > 0) {
        for (const w of waiting.splice(0)) {
          if (w.until !== null && ctx.clock.now() < w.until) ctx.clock.advance(w.until - ctx.clock.now());
          w.done();
        }
        quiet = 0;
        idle = 0;
        continue;
      }
      if (gauge.active === 0 && ++idle > IDLE_TURNS) {
        const deadline = ctx.clock.next();
        const why =
          deadline === null
            ? "the scenario waits and nothing in the run is due"
            : `the scenario waits past the horizon: next deadline ${deadline} ms`;
        reject(fail("E1727", why, { next: deadline }));
        return;
      }
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
    run,
    failure,
    stop: async () => {
      over = true;
      observer?.disconnect();
      harnessGauges.delete(ctx.clock);
      await running;
    },
  };
}
