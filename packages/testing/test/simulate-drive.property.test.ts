// Spec: k.sim Driving and Law. Property seed: 1337.
import { register } from "@keel/ctx";
import { simulate } from "@keel/testing";
import * as fc from "fast-check";
import { expect, it } from "vitest";

const SEED = 1337;

/** `n` macrotask turns of the event loop, none of them a timer. */
const turns = async (n: number): Promise<void> => {
  for (let i = 0; i < n; i++)
    await new Promise<void>((done) => {
      const ch = new MessageChannel();
      ch.port1.onmessage = () => {
        ch.port1.close();
        done();
      };
      ch.port2.postMessage(0);
    });
};

/** How many turns the held work of the next call takes: set by the property, never read by the run's decisions. */
const speed = { turns: 1 };
type Probe = { work(): Promise<void> };
const probe = register("simDrivePropertyProbe", {
  real: (): Probe => ({ work: () => Promise.resolve() }),
  shell: (): Probe => ({ work: () => Promise.resolve() }),
  sim: ({ hold }): Probe => ({ work: () => hold(turns(speed.turns), "probe") }),
});

type Step = { wait: number; held: boolean };
const stepArb: fc.Arbitrary<Step> = fc.record({ wait: fc.integer({ min: 0, max: 900 }), held: fc.boolean() });
const windowArb = fc.record({ at: fc.integer({ min: 1, max: 1200 }), ms: fc.integer({ min: 1, max: 400 }) });

type Trace = { moves: [string, number][]; end: number };

async function trace(steps: Step[], offline: { at: number; ms: number }[], seed: number, pace: number, noisy: boolean) {
  speed.turns = pace;
  const out: Trace = { moves: [], end: -1 };
  let noise = true;
  // A concurrent chatter of macrotask turns changes when each turn happens relative to the run's, not what it decides.
  const chatter = noisy
    ? (async () => {
        while (noise) await turns(1);
      })()
    : Promise.resolve();
  await simulate(
    async ({ ctx, run }) => {
      const chains = steps.map(async (step, n) => {
        await ctx.clock.after(step.wait);
        if (step.held) await probe(ctx).work();
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
  noise = false;
  await chatter;
  return out;
}

it("one SimRun and one scenario take the same moments at the same clock times whatever the macrotask scheduling", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(stepArb, { minLength: 1, maxLength: 6 }),
      fc.array(windowArb, { maxLength: 2 }),
      fc.integer({ min: 0, max: 2 ** 31 - 1 }),
      fc.integer({ min: 1, max: 40 }),
      async (steps, offline, seed, pace) => {
        const quiet = await trace(steps, offline, seed, 1, false);
        const slow = await trace(steps, offline, seed, pace, true);
        expect(slow).toEqual(quiet);
        // Each chain is seen at its wait's time: held work adds no sim time.
        for (const [name, at] of quiet.moves) {
          const step = steps[Number(name)];
          if (step !== undefined) expect(at).toBe(step.wait);
        }
        // `run(300)` takes the clock to exactly 300 past the moment the last chain was seen, never earlier.
        const last = Math.max(0, ...steps.map((s) => s.wait));
        expect(quiet.end).toBeGreaterThanOrEqual(last + 300);
      },
    ),
    { seed: SEED, numRuns: 25 },
  );
});

it("the clock never moves while held work is pending, whatever its length in macrotask turns", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 120 }), fc.integer({ min: 1, max: 5000 }), async (pace, wait) => {
      speed.turns = pace;
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
