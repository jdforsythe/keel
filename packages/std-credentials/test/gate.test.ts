// Seed 1337. The queue over a stubbed derivation: for generated arrival orders and each `ln`, never more than the run
// bound at once, starts in call order, `null` (busy) exactly when the waiting bound is full, and a failed derivation
// frees its slot.
import fc from "fast-check";
import { expect, test } from "vitest";
import { gate } from "../src/server/internal/gate.ts";

const SEED = 1337;
const flush = async (): Promise<void> => {
  for (let i = 0; i < 4; i++) await new Promise<void>((go) => setImmediate(go));
};

type Op = { readonly kind: "call" } | { readonly kind: "end"; readonly pick: number; readonly fail: boolean };
const op: fc.Arbitrary<Op> = fc.oneof(
  fc.constant<Op>({ kind: "call" }),
  fc.record({ kind: fc.constant<"end">("end"), pick: fc.nat({ max: 7 }), fail: fc.boolean() }),
);

test("bounds, order, busy and freed slots for generated arrivals", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 17, max: 20 }), fc.array(op, { maxLength: 60 }), async (ln, ops) => {
      const bound = ln <= 18 ? 2 : 1;
      const limit = 16 >> (ln - 17);
      const g = gate(ln);
      expect(g.limit).toBe(limit);
      const running: { index: number; end: (fail: boolean) => void }[] = [];
      const started: number[] = [];
      const admitted: number[] = [];
      const outcomes = new Map<number, number | null>();
      const expected = new Map<number, number | null>();
      let modelRunning = 0;
      let modelWaiting = 0;
      let calls = 0;
      let peak = 0;
      const call = (): void => {
        const index = calls++;
        const full = modelRunning >= bound && modelWaiting >= limit;
        if (full) expected.set(index, null);
        else {
          admitted.push(index);
          if (modelRunning < bound) modelRunning++;
          else modelWaiting++;
        }
        void g
          .run(
            () =>
              new Promise<number>((done, fail) => {
                started.push(index);
                running.push({ index, end: (f) => (f ? fail(new Error("refused")) : done(index)) });
                peak = Math.max(peak, running.length);
              }),
          )
          .then((v) => outcomes.set(index, v));
      };
      for (const o of ops) {
        if (o.kind === "call") call();
        else if (running.length > 0) {
          const [job] = running.splice(o.pick % running.length, 1);
          if (job === undefined) continue;
          expected.set(job.index, o.fail ? null : job.index);
          job.end(o.fail);
          if (modelWaiting > 0) modelWaiting--;
          else modelRunning--;
        }
        await flush();
      }
      while (running.length > 0) {
        const job = running.shift();
        if (job === undefined) break;
        expected.set(job.index, job.index);
        job.end(false);
        await flush();
      }
      await flush();
      expect(peak).toBeLessThanOrEqual(bound);
      expect(started).toEqual(admitted);
      expect(outcomes).toEqual(expected);
    }),
    { seed: SEED, numRuns: 200 },
  );
});

test("19 calls at once at ln 17: 2 run, 16 wait, one is refused", async () => {
  const g = gate(17);
  const ends: (() => void)[] = [];
  const results = Array.from({ length: 19 }, (_, i) =>
    g.run(() => new Promise<number>((done) => ends.push(() => done(i)))),
  );
  await flush();
  expect(ends).toHaveLength(2);
  while (ends.length > 0) {
    ends.shift()?.();
    await flush();
  }
  const values = await Promise.all(results);
  expect(values.filter((v) => v === null)).toHaveLength(1);
  expect(values[18]).toBeNull();
});
