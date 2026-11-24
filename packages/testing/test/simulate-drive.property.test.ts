// Spec: k.drive Driving and Law. Property seed: 1337.
import { pbkdf2 } from "node:crypto";
import { setTimeout } from "node:timers";
import { register } from "@keel/ctx";
import { simulate } from "@keel/testing";
import * as fc from "fast-check";
import { afterAll, expect, it } from "vitest";

const SEED = 1337;

/** A channel made before any run: held work below answers through it, as an engine or worker made outside the run does. */
const outside = new MessageChannel();
outside.port2.onmessage = (e: MessageEvent<number>) => {
  outside.port2.postMessage(e.data);
};
const pending = new Map<number, () => void>();
let ids = 0;
outside.port1.onmessage = (e: MessageEvent<number>) => {
  pending.get(e.data)?.();
  pending.delete(e.data);
};

afterAll(() => {
  outside.port1.close();
  outside.port2.close();
});

/** `n` round trips through the channel made outside the run. */
const bounce = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++)
    await new Promise<void>((done) => {
      const id = ids++;
      pending.set(id, done);
      outside.port1.postMessage(id);
    });
};

/** How many round trips the held work of the next call takes: set by the property, never read by the run's decisions. */
const speed = { trips: 1 };
type Probe = { work(): Promise<void> };
const probe = register("simDrivePropertyProbe", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({ work: () => hold("probe", () => bounce(speed.trips)) }),
});

type Kind = "wait" | "held" | "timer" | "hash";
type Step = { wait: number; kind: Kind };
const stepArb: fc.Arbitrary<Step> = fc.record({
  wait: fc.integer({ min: 0, max: 900 }),
  kind: fc.constantFrom<Kind>("wait", "held", "timer", "hash"),
});
const windowArb = fc.record({ at: fc.integer({ min: 1, max: 1200 }), ms: fc.integer({ min: 1, max: 400 }) });

type Trace = { moves: [string, number][]; end: number };

/** How long the real work takes: a real timer of `pace` ms, a hash of `pace * 500` iterations, `pace` round trips. */
async function trace(steps: Step[], offline: { at: number; ms: number }[], seed: number, pace: number) {
  speed.trips = pace;
  const out: Trace = { moves: [], end: -1 };
  await simulate(
    async ({ ctx, run }) => {
      const chains = steps.map(async (step, n) => {
        await ctx.clock.after(step.wait);
        // Real work the scenario observes: the scenario sees the clock when it ends, which is where it started.
        if (step.kind === "held") await probe(ctx).work();
        if (step.kind === "timer") await new Promise<void>((done) => setTimeout(done, pace));
        if (step.kind === "hash")
          await new Promise<void>((done, no) => {
            pbkdf2("pw", "salt", pace * 500, 16, "sha256", (e) => (e === null ? done() : no(e)));
          });
        out.moves.push([`${n}`, ctx.clock.now()]);
      });
      await Promise.all(chains);
      await run(300);
      out.moves.push(["end", ctx.clock.now()]);
      await run();
      out.end = ctx.clock.now();
    },
    { replay: { seed, schedule: { net: [], storage: [], offline, plans: {} } } },
  );
  return out;
}

it("one SimRun and one scenario take the same moments at the same clock times whatever the real durations of the work they observe", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(stepArb, { minLength: 1, maxLength: 6 }),
      fc.array(windowArb, { maxLength: 2 }),
      fc.integer({ min: 0, max: 2 ** 31 - 1 }),
      fc.integer({ min: 1, max: 40 }),
      async (steps, offline, seed, pace) => {
        const quick = await trace(steps, offline, seed, 1);
        const slow = await trace(steps, offline, seed, pace);
        expect(slow).toEqual(quick);
        // Each chain is seen at its wait's time: real and held work add no sim time.
        for (const [name, at] of quick.moves) {
          const step = steps[Number(name)];
          if (step !== undefined) expect(at).toBe(step.wait);
        }
        // `run(300)` takes the clock to exactly 300 past the moment the last chain was seen, never earlier.
        const last = Math.max(0, ...steps.map((s) => s.wait));
        expect(quick.end).toBeGreaterThanOrEqual(last + 300);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

it("the clock never moves while held work is pending, whatever its length in round trips", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 1, max: 5000 }), async (pace, wait) => {
      speed.trips = pace;
      const seen: number[] = [];
      await simulate(
        async ({ ctx }) => {
          void ctx.clock.after(wait);
          await probe(ctx).work();
          seen.push(ctx.clock.now());
        },
        { replay: { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } } },
      );
      expect(seen).toEqual([0]);
    }),
    { seed: SEED, numRuns: 15 },
  );
});
