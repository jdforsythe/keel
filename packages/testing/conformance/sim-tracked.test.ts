// @vitest-environment happy-dom
// Spec: k.drive, clause "In an empty replay, for each `d` of 0, 12 and 50, a scenario that starts `ctx.clock.after(10)` and a `setTimeout(d)` of `node:timers`, each recording its name and `ctx.clock.now()` as it resolves, then awaits `run()`: the record is `real` at 0, then `timer` at 10."
// Spec: k.drive, clause "In an empty replay, a scenario that starts a `ctx.clock.after(5)` waiter recording whether a `node:crypto` `pbkdf2` of 100,000 iterations started before it has answered, then awaits the hash and `run()`: the waiter records `true` at clock 5."
// Spec: k.drive, clause "In an empty replay, a scenario that starts work writing `'running'` to a storage key, awaiting `ctx.clock.after(1000)`, then writing `'done'`: after `await run(500)` the key reads `'running'` and the clock is 500; after a following `await run(600)`, `'done'`."
// k.drive, Driving "On each of its turns, while the scenario is pending and no work is pending, the drive advances the clock to the next moment if it is at most `horizon` ms past the run's start (or, while a `run(ms)` waits, at most its `t + ms`)."
// k.drive, Driving "Real work's speed decides nothing."
// k.drive, Driving "each async resource other than a promise created in that context outside held work, from its creation until Node destroys it: a timer or immediate after its callback, a file, DNS or thread-pool request (a password hash) after it answers, a socket, server, interval or port once closed;"
// k.drive, Driving "held work, until it is delivered (k.drive-law Order); a resource created in held work's async context (an engine's own timer armed in a held call) is the hold's, not work of the run;"
// k.drive, Driving "a harness `fire`, `settle`, `navigate` or render in progress, but not while it waits only on an unanswered `ctx.net` route."
// k.drive, Driving "A resource a garbage collection would destroy is not pending: when the drive reads one set of pending resources on two turns in a row and, since its last collection, a resource has joined the set or a callback of one has run, it runs one full garbage collection, and a resource that collection destroys (a synchronous call's job, a finished stream's handle) is not pending."
// Spec: k.drive, clause "In an empty replay, for each `d` of 1, 2 and 20, `fire` on a `render` handle on the run's ctx whose handler starts a `node:timers` `setTimeout(d)` that writes `'late'` to storage key `k` resolves with `k` reading `'late'`."
// Spec: k.drive, clause "In an empty replay under `budget: 2000`, a scenario that awaits a `node:zlib` `gzip` (the callback form) of `Buffer.alloc(4 * 1024 * 1024)`, then awaits `ctx.clock.after(1)`, resolves `simulate` with `ctx.clock.now()` 1 after the second await."
// Spec: k.drive, clause "In an empty replay under `budget: 300`, a scenario that calls `node:crypto` `pbkdf2Sync` of 1,000 iterations and `node:zlib` `gzipSync`, then awaits `ctx.clock.after(10)`, resolves `simulate` with `ctx.clock.now()` 10 after the await."
// k.drive, Driving "The harness's and the drive's own macrotask turns are made outside the run's context and are not work; the drive moves the clock inside the run's context, so waiters, offline-edge callbacks and `observe` callbacks it runs make work of the run."
// Spec: k.drive, clause "Under `simulate` with `replay` of a `SimRun` of seed 1 whose schedule's `offline` is `[{ at: 100, ms: 50 }]`, an `observe` callback that, on the `net` event at 100, starts a `node:timers` `setTimeout(20)` recording `ctx.clock.now()` as it answers: it records 100, and after `run()` the clock is 150."
// Seed: 1337 (fc.assert below); replays use a SimRun of seed 1 and an empty schedule.
// ASSUMPTION: "inside app code" is a `ctx.net` route handler (a sim route runs as app code, k.drive Seams) or the scenario itself, which runs in the run's context; both are asserted. The route's fetch takes the default net step `{ delay: 0, fault: 'none' }`.
// ASSUMPTION: "never lets the clock pass it" is read as: a `ctx.clock.after(10)` waiter started beside the real work resolves after it, so the record is the real completion at clock 0, then `timer` at 10, whatever the real duration.
// UNTESTABLE: a dynamic import in app code. k.drive Law names an `import()` that the test runner answers over its own channel as what the law check reports, so no ordering is asserted; the harness's module load (a route's chunk) is k.drive #15 in packages/server/conformance/sim-route-load.test.ts.
import { pbkdf2, pbkdf2Sync } from "node:crypto";
import { readFile } from "node:fs/promises";
import { setImmediate, setTimeout } from "node:timers";
import { fileURLToPath } from "node:url";
import { gzip, gzipSync } from "node:zlib";
import type { Ctx } from "@keel/ctx";
import { observe } from "@keel/ctx";
import { s } from "@keel/schema";
import { clone, on, template } from "@keel/runtime-dom/ops";
import { render, simulate } from "@keel/testing";
import { fixedTime, testTime } from "@keel/tooling/test-time";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED } from "./fixtures.ts";

const replay = { seed: 1, schedule: { net: [], storage: [], offline: [], plans: {} } };

/**
 * What a property case with real timers bounds, for each `raced` or `fireLate` its runs make: the real delay the run
 * starts, at most 40 ms, an input that does not scale; and the run around it, a few milliseconds here, given 300 ms so
 * a runner ten times slower (scale 0.1) still has 30 ms. `simulate` takes its budget from the case's timeout, so the
 * fixed part keeps the delays inside it at every scale.
 */
const REAL_MS = 40;
const RUN_MS = 300;

type Real =
  | { kind: "timeout"; ms: number }
  | { kind: "immediates"; n: number }
  | { kind: "file" }
  | { kind: "hash"; iterations: number };

const realArb: fc.Arbitrary<Real> = fc.oneof(
  fc.record({ kind: fc.constant("timeout" as const), ms: fc.integer({ min: 0, max: 40 }) }),
  fc.record({ kind: fc.constant("immediates" as const), n: fc.integer({ min: 1, max: 20 }) }),
  fc.record({ kind: fc.constant("file" as const) }),
  fc.record({ kind: fc.constant("hash" as const), iterations: fc.integer({ min: 1, max: 30_000 }) }),
);

/** Real asynchronous work of one kind, started where the caller is. */
async function real(w: Real): Promise<void> {
  if (w.kind === "timeout") await new Promise<void>((resolve) => setTimeout(resolve, w.ms));
  else if (w.kind === "immediates") for (let i = 0; i < w.n; i++) await new Promise<void>((r) => setImmediate(r));
  else if (w.kind === "file") await readFile(fileURLToPath(import.meta.url));
  else
    await new Promise<void>((resolve, reject) => {
      pbkdf2("pw", "salt", w.iterations, 32, "sha256", (e) => (e === null ? resolve() : reject(e)));
    });
}

type Rec = { name: string; at: number };

/** `ctx.clock.after(10)` and the real work started together; `where` says whether the work runs in the scenario or in a `ctx.net` route. */
async function raced(w: Real, where: "scenario" | "route", span = 0): Promise<Rec[]> {
  const rec: Rec[] = [];
  await simulate(
    async ({ ctx, run }) => {
      const timer = ctx.clock.after(10).then(() => void rec.push({ name: "timer", at: ctx.clock.now() }));
      let done: Promise<void>;
      if (where === "scenario") done = real(w);
      else {
        ctx.net.route("https://work.test/*", async () => {
          await real(w);
          return new Response("ok");
        });
        done = ctx.net.fetch(new Request("https://work.test/a")).then(() => undefined);
      }
      const finished = done.then(() => void rec.push({ name: "real", at: ctx.clock.now() }));
      if (span > 0) await run(span);
      else await run();
      await Promise.all([timer, finished]);
    },
    { replay },
  );
  return rec;
}

test("In an empty replay, for each `d` of 0, 12 and 50, a scenario that starts `ctx.clock.after(10)` and a `setTimeout(d)` of `node:timers`, each recording its name and `ctx.clock.now()` as it resolves, then awaits `run()`: the record is `real` at 0, then `timer` at 10.", async () => {
  for (const d of [0, 12, 50]) {
    const rec: Rec[] = [];
    await simulate(
      async ({ ctx, run }) => {
        const timer = ctx.clock.after(10).then(() => void rec.push({ name: "timer", at: ctx.clock.now() }));
        const bare = new Promise<void>((resolve) => {
          setTimeout(() => {
            rec.push({ name: "real", at: ctx.clock.now() });
            resolve();
          }, d);
        });
        await run();
        await Promise.all([timer, bare]);
      },
      { replay },
    );
    expect(rec).toEqual([
      { name: "real", at: 0 },
      { name: "timer", at: 10 },
    ]);
  }
});

test(
  "a bare `setTimeout(d)` for any real `d` from 0 to 40 ms, in the scenario or in a `ctx.net` route, records `real` at 0 and then `timer` at 10",
  async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.integer({ min: 0, max: 40 }),
        fc.constantFrom("scenario" as const, "route" as const),
        async (ms, where) => {
          expect(await raced({ kind: "timeout", ms }, where)).toEqual([
            { name: "real", at: 0 },
            { name: "timer", at: 10 },
          ]);
        },
      ),
      { seed: SEED, numRuns: 20 },
    );
  },
  fixedTime(20 * REAL_MS) + testTime(20 * RUN_MS),
);

test(
  "real work of any kind (a `setTimeout`, a chain of `setImmediate`, a file read, a hash on the thread pool), started in the scenario or in a `ctx.net` route, never changes the trace and never lets the clock pass it: `real` at 0, `timer` at 10, the same on every run",
  async () => {
    await fc.assert(
      fc.asyncProperty(realArb, fc.constantFrom("scenario" as const, "route" as const), async (w, where) => {
        const first = await raced(w, where);
        const second = await raced(w, where);
        expect(first).toEqual([
          { name: "real", at: 0 },
          { name: "timer", at: 10 },
        ]);
        expect(second).toEqual(first);
      }),
      { seed: SEED, numRuns: 20 },
    );
  },
  fixedTime(20 * 2 * REAL_MS) + testTime(20 * 2 * RUN_MS),
);

test(
  "real work pending across `run(ms)` holds the clock where it was: `run(ms)` with the work in flight still ends at `t + ms` with `real` at 0 and `timer` at 10 when `ms` passes 10",
  async () => {
    await fc.assert(
      fc.asyncProperty(realArb, fc.integer({ min: 10, max: 500 }), async (w, span) => {
        expect(await raced(w, "scenario", span)).toEqual([
          { name: "real", at: 0 },
          { name: "timer", at: 10 },
        ]);
      }),
      { seed: SEED, numRuns: 15 },
    );
  },
  fixedTime(15 * REAL_MS) + testTime(15 * RUN_MS),
);

test("In an empty replay, a scenario that starts a `ctx.clock.after(5)` waiter recording whether a `node:crypto` `pbkdf2` of 100,000 iterations started before it has answered, then awaits the hash and `run()`: the waiter records `true` at clock 5.", async () => {
  const seen: { answered: boolean; at: number }[] = [];
  await simulate(
    async ({ ctx, run }) => {
      let answered = false;
      const hash = new Promise<void>((resolve, reject) => {
        pbkdf2("pw", "salt", 100_000, 32, "sha256", (e) => {
          answered = true;
          if (e === null) resolve();
          else reject(e);
        });
      });
      const waiter = ctx.clock.after(5).then(() => void seen.push({ answered, at: ctx.clock.now() }));
      await hash;
      await run();
      await waiter;
    },
    { replay },
  );
  expect(seen).toEqual([{ answered: true, at: 5 }]);
});

test("In an empty replay, a scenario that starts work writing `'running'` to a storage key, awaiting `ctx.clock.after(1000)`, then writing `'done'`: after `await run(500)` the key reads `'running'` and the clock is 500; after a following `await run(600)`, `'done'`.", async () => {
  const seen: { job: string | null; now: number }[] = [];
  await simulate(
    async ({ ctx, run }) => {
      const work = (async () => {
        await ctx.storage.set("job", "running");
        await ctx.clock.after(1000);
        await ctx.storage.set("job", "done");
      })();
      await run(500);
      seen.push({ job: await ctx.storage.get("job"), now: ctx.clock.now() });
      await run(600);
      seen.push({ job: await ctx.storage.get("job"), now: ctx.clock.now() });
      await work;
    },
    { replay },
  );
  expect(seen).toEqual([
    { job: "running", now: 500 },
    { job: "done", now: 1100 },
  ]);
});

test("work parked on a deadline `D` reads `'running'` after `run(c)` for any `c` below `D` and `'done'` once `run` has passed `D`, at exactly `t + ms` each time", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 2, max: 5000 }), fc.integer({ min: 0, max: 4999 }), async (D, c0) => {
      const c = c0 % D;
      const seen: { job: string | null; now: number }[] = [];
      await simulate(
        async ({ ctx, run }) => {
          const work = (async () => {
            await ctx.storage.set("job", "running");
            await ctx.clock.after(D);
            await ctx.storage.set("job", "done");
          })();
          await run(c);
          seen.push({ job: await ctx.storage.get("job"), now: ctx.clock.now() });
          await run(D - c);
          seen.push({ job: await ctx.storage.get("job"), now: ctx.clock.now() });
          await work;
        },
        { replay },
      );
      expect(seen).toEqual([
        { job: "running", now: c },
        { job: "done", now: D },
      ]);
    }),
    { seed: SEED, numRuns: 25 },
  );
});

// ASSUMPTION: the `net` event is recognised by its JSON holding `"net"`, with the clock at 100 (the event's own fields are k.ctx's, not named here).
test("Under `simulate` with `replay` of a `SimRun` of seed 1 whose schedule's `offline` is `[{ at: 100, ms: 50 }]`, an `observe` callback that, on the `net` event at 100, starts a `node:timers` `setTimeout(20)` recording `ctx.clock.now()` as it answers: it records 100, and after `run()` the clock is 150.", async () => {
  const seen: number[] = [];
  let after = -1;
  let started = false;
  await simulate(
    async ({ ctx, run }) => {
      observe(ctx, (e) => {
        if (started || ctx.clock.now() !== 100 || !JSON.stringify(e).includes('"net"')) return;
        started = true;
        setTimeout(() => void seen.push(ctx.clock.now()), 20);
      });
      await run();
      after = ctx.clock.now();
    },
    { replay: { seed: 1, schedule: { net: [], storage: [], offline: [{ at: 100, ms: 50 }], plans: {} } } },
  );
  expect(seen).toEqual([100]);
  expect(after).toBe(150);
});

// ASSUMPTION: the `render` handle's `fire` of the click on `late.go` is the harness call in progress; the handler's `setTimeout(d)` is real work of the run, so `fire` resolves only after it has answered.
const LateT = template('<div><button id="late.go" data-k="late.go">go</button></div>');
const LateView = Object.assign(
  (props: { readonly ms: number }, ctx: Ctx): Node => {
    const root = clone(LateT);
    on("late.go", "click", () => {
      setTimeout(() => {
        void ctx.storage.set("k", "late");
      }, props.ms);
    });
    return root;
  },
  { Props: s.object({ ms: s.int() }) },
);

async function fireLate(ms: number): Promise<string | null> {
  let seen: string | null = null;
  await simulate(
    async ({ ctx }) => {
      const t = render(LateView, { props: { ms }, ctx });
      await t.fire("late.go", { type: "click" });
      seen = await ctx.storage.get("k");
      t.dispose();
    },
    { replay },
  );
  return seen;
}

test("In an empty replay, for each `d` of 1, 2 and 20, `fire` on a `render` handle on the run's ctx whose handler starts a `node:timers` `setTimeout(d)` that writes `'late'` to storage key `k` resolves with `k` reading `'late'`.", async () => {
  for (const d of [1, 2, 20]) expect(await fireLate(d)).toBe("late");
});

test(
  "`fire` waits for the real timer its handler starts, for any real delay from 0 to 40 ms",
  async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 40 }), async (d) => {
        expect(await fireLate(d)).toBe("late");
      }),
      { seed: SEED, numRuns: 12 },
    );
  },
  fixedTime(12 * REAL_MS) + testTime(12 * RUN_MS),
);

test("In an empty replay under `budget: 300`, a scenario that calls `node:crypto` `pbkdf2Sync` of 1,000 iterations and `node:zlib` `gzipSync`, then awaits `ctx.clock.after(10)`, resolves `simulate` with `ctx.clock.now()` 10 after the await.", async () => {
  let now = -1;
  await simulate(
    async ({ ctx }) => {
      pbkdf2Sync("pw", "salt", 1000, 32, "sha256");
      gzipSync(Buffer.from("keel"));
      await ctx.clock.after(10);
      now = ctx.clock.now();
    },
    { replay, budget: 300 },
  );
  expect(now).toBe(10);
});

test("synchronous `pbkdf2Sync` and `gzipSync` calls, any number of them with any iteration count, are not work: the scenario resolves with the clock at its wait", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 1, max: 5 }),
      fc.integer({ min: 1, max: 3000 }),
      fc.integer({ min: 1, max: 500 }),
      async (calls, iterations, wait) => {
        let now = -1;
        await simulate(
          async ({ ctx }) => {
            for (let i = 0; i < calls; i++) {
              pbkdf2Sync("pw", "salt", iterations, 32, "sha256");
              gzipSync(Buffer.from(`keel${i}`));
            }
            await ctx.clock.after(wait);
            now = ctx.clock.now();
          },
          { replay, budget: 300 },
        );
        expect(now).toBe(wait);
      },
    ),
    { seed: SEED, numRuns: 10 },
  );
});

async function gzipThenWait(bytes: number): Promise<number> {
  let now = -1;
  await simulate(
    async ({ ctx }) => {
      await new Promise<void>((resolve, reject) => {
        gzip(Buffer.alloc(bytes), (e) => (e === null ? resolve() : reject(e)));
      });
      await ctx.clock.after(1);
      now = ctx.clock.now();
    },
    { replay, budget: 2000 },
  );
  return now;
}

test("In an empty replay under `budget: 2000`, a scenario that awaits a `node:zlib` `gzip` (the callback form) of `Buffer.alloc(4 * 1024 * 1024)`, then awaits `ctx.clock.after(1)`, resolves `simulate` with `ctx.clock.now()` 1 after the second await.", async () => {
  expect(await gzipThenWait(4 * 1024 * 1024)).toBe(1);
});

test("a callback-form `gzip` of any buffer from a few bytes to a few MB leaves no work: the scenario resolves with the clock at 1 after the following `ctx.clock.after(1)`", async () => {
  await fc.assert(
    fc.asyncProperty(fc.integer({ min: 1, max: 4 * 1024 * 1024 }), async (bytes) => {
      expect(await gzipThenWait(bytes)).toBe(1);
    }),
    { seed: SEED, numRuns: 8 },
  );
});
