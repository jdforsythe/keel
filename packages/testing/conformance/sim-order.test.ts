// @vitest-environment happy-dom
// Spec: k.drive-law, Conformance "A capability registered with a `sim` factory whose `work(ms)` returns `hold('probe', () => new Promise((r) => setTimeout(r, ms)))` (`node:timers`): in an empty replay, a scenario that calls `work(50)` and then `work(0)`, recording `'a'` when the first answers and `'b'` when the second does, then awaits both, records `['a', 'b']`, and `simulate` resolves."
// Spec: k.drive-law, Order "Held work that settles is *delivered*, its promise settled for the code awaiting it, on a drive turn once every hold of the run started before it is delivered and no thread-pool request of the run is pending: holds answer in the order they started."
// Spec: k.drive-law, Order "A thread-pool request is a request Node runs on its thread pool (a file system call, a DNS lookup, a `node:crypto` job); a `node:zlib` handle, a stream's or a one-shot call's, is not one."
// Spec: k.drive-law, Conformance "A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => Promise.resolve())`: in an empty replay under `budget: 300`, a scenario that opens a `node:zlib` `createGzip()` stream, awaits `work()`, then destroys the stream, resolves `simulate`."
// Spec: k.drive-law, Law "Four things escape the drive and can change a trace: a resource made before the run or outside its context (a worker started at import, a module-level timer, channel or `AsyncResource`), unless the work answering through it is held; an `import()` in app code other than a harness's `routes` loader, which the test runner answers over its own channel; state kept outside the run's stores from one run to the next; real asynchronous work made in the run outside every seam (k.drive), whose completions the drive does not deliver, running beside a hold or other such work (a `node:timers` timer, a file read, a socket's data)."
// Spec: k.drive-law, Order "A hold whose settling waits on a later hold's delivery (k.sim forbids it) never settles, and the budget ends the run."
// Spec: k.sim, plans "`hold(label, start)` calls `start()` and returns a promise of its outcome, held (k.drive) until it is delivered, in start order (k.drive-law Order)."
// Spec: k.drive, Driving "held work, until it is delivered (k.drive-law Order); a resource created in held work's async context (an engine's own timer armed in a held call) is the hold's, not work of the run;"
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule.
// ASSUMPTION: a hold whose `start` arms a `node:timers` timer of `ms` real ms is answered by real time; the clause's order is the start order whatever the real delays, so the property ranges over generated real delays (0 to 30 ms) and hold counts.
// ASSUMPTION: "no thread-pool request of the run is pending" is observed with a `node:crypto` `pbkdf2` started before a hold that settles at once: the hash answers first, the hold is delivered after.
// ASSUMPTION: a hold waiting on a later hold's delivery ends the run with E1728 `the budget ran out with work in flight` naming both holds, oldest first (the RFC's "the budget names both").
import { pbkdf2 } from "node:crypto";
import { setTimeout } from "node:timers";
import { createGzip } from "node:zlib";
import { register } from "@keel/ctx";
import { simulate } from "@keel/testing";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, codeOf, messageOf, thrown } from "./fixtures.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

type Probe = {
  work(ms: number): Promise<void>;
  instant(): Promise<void>;
  gated(gate: Promise<void>): Promise<void>;
  quick(): Promise<void>;
};
const probe = register("simOrderProbe", {
  real: (): Probe => ({
    work: () => Promise.resolve(),
    instant: () => Promise.resolve(),
    gated: () => Promise.resolve(),
    quick: () => Promise.resolve(),
  }),
  shell: (): Probe => ({
    work: () => Promise.resolve(),
    instant: () => Promise.resolve(),
    gated: () => Promise.resolve(),
    quick: () => Promise.resolve(),
  }),
  sim: ({ hold }): Probe => ({
    work: (ms) => hold("probe", () => new Promise<void>((r) => setTimeout(r, ms))),
    instant: () => hold("instant", () => Promise.resolve()),
    gated: (gate) => hold("first", () => gate),
    quick: () => hold("second", () => Promise.resolve()),
  }),
});

const own = register("simOrderOwn", {
  real: () => ({ run: () => Promise.resolve() }),
  shell: () => ({ run: () => Promise.resolve() }),
  sim: ({ hold }) => ({
    run: () =>
      hold("own", () => {
        setTimeout(() => undefined, 30);
        return Promise.resolve();
      }),
  }),
});

async function answerOrder(delays: readonly number[]): Promise<string[]> {
  const record: string[] = [];
  await simulate(
    async ({ ctx }) => {
      const pending = delays.map((ms, i) =>
        probe(ctx)
          .work(ms)
          .then(() => void record.push(String(i))),
      );
      await Promise.all(pending);
    },
    { replay },
  );
  return record;
}

test("A capability registered with a `sim` factory whose `work(ms)` returns `hold('probe', () => new Promise((r) => setTimeout(r, ms)))` (`node:timers`): in an empty replay, a scenario that calls `work(50)` and then `work(0)`, recording `'a'` when the first answers and `'b'` when the second does, then awaits both, records `['a', 'b']`, and `simulate` resolves.", async () => {
  const record: string[] = [];
  await simulate(
    async ({ ctx }) => {
      const a = probe(ctx)
        .work(50)
        .then(() => void record.push("a"));
      const b = probe(ctx)
        .work(0)
        .then(() => void record.push("b"));
      await Promise.all([a, b]);
    },
    { replay },
  );
  expect(record).toEqual(["a", "b"]);
});

test("holds answer in the order they started, whatever their real delays: for any count of holds and any real delay each, the record is the start order", async () => {
  await fc.assert(
    fc.asyncProperty(fc.array(fc.integer({ min: 0, max: 30 }), { minLength: 1, maxLength: 5 }), async (delays) => {
      expect(await answerOrder(delays)).toEqual(delays.map((_, i) => String(i)));
    }),
    { seed: SEED, numRuns: 15 },
  );
});

test("a hold that settles is delivered only once no thread-pool request of the run is pending: a hold started after a hash, settling at once, is delivered after the hash answers", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 20_000 }), async (iterations) => {
      const record: string[] = [];
      await simulate(
        async ({ ctx }) => {
          const hash = new Promise<void>((resolve, reject) => {
            pbkdf2("pw", "salt", iterations, 32, "sha256", (e) => {
              record.push("hash");
              if (e === null) resolve();
              else reject(e);
            });
          });
          const held = probe(ctx)
            .instant()
            .then(() => void record.push("hold"));
          await Promise.all([hash, held]);
        },
        { replay },
      );
      expect(record).toEqual(["hash", "hold"]);
    }),
    { seed: SEED, numRuns: 8 },
  );
});

test("a resource created in held work's async context is the hold's, not work of the run: a hold whose start also arms a timer longer than the hold's answer lets the scenario resolve once the hold is delivered", async () => {
  await simulate(
    async ({ ctx }) => {
      await own(ctx).run();
    },
    { replay, budget: 300 },
  );
});

test("A hold whose settling waits on a later hold's delivery (k.sim forbids it) never settles, and the budget ends the run: E1728 names both holds, oldest first", async () => {
  const e = await thrown(() =>
    simulate(
      async ({ ctx }) => {
        let open: () => void = () => undefined;
        const gate = new Promise<void>((resolve) => {
          open = resolve;
        });
        const first = probe(ctx).gated(gate);
        const second = probe(ctx)
          .quick()
          .then(() => open());
        await Promise.all([first, second]);
      },
      { replay, budget: 300 },
    ),
  );
  expect(codeOf(e)).toBe("E1704");
  expect(messageOf(e).split("\n")[0]).toContain("E1728 the budget ran out with work in flight: first, second");
});

const quick = register("simOrderQuick", {
  real: () => ({ work: () => Promise.resolve() }),
  shell: () => ({ work: () => Promise.resolve() }),
  sim: ({ hold }) => ({ work: () => hold("probe", () => Promise.resolve()) }),
});

test("A capability registered with a `sim` factory whose `work()` returns `hold('probe', () => Promise.resolve())`: in an empty replay under `budget: 300`, a scenario that opens a `node:zlib` `createGzip()` stream, awaits `work()`, then destroys the stream, resolves `simulate`.", async () => {
  await simulate(
    async ({ ctx }) => {
      const stream = createGzip();
      try {
        await quick(ctx).work();
      } finally {
        stream.destroy();
      }
    },
    { replay, budget: 300 },
  );
});

test("any number of open `createGzip()` streams delay no hold's delivery: the hold is delivered and the scenario resolves under `budget: 300`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 }), async (streams) => {
      await simulate(
        async ({ ctx }) => {
          const open = Array.from({ length: streams }, () => createGzip());
          try {
            await quick(ctx).work();
          } finally {
            for (const s of open) s.destroy();
          }
        },
        { replay, budget: 300 },
      );
    }),
    { seed: SEED, numRuns: 5 },
  );
});
