// std.schedules Restart: "If fire times passed since the mark, 'once' enqueues one job for the latest of them and
// 'skip' none." Run: "The key makes a fire time enqueue at most one job". Across downtimes no fire key repeats. Seed 4242
import { createCtx } from "@keel/ctx";
import { ok, s } from "@keel/schema";
import fc from "fast-check";
import { expect, test, vi } from "vitest";
import { schedule } from "../src/index.ts";
import { jobs as orders } from "./modules/orders/jobs.server.ts";

const MIN = 60_000;
const DAY = 24 * 60 * MIN;
const T0 = Date.parse("2026-11-10T10:00:30.000Z");

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};

function fixture(cron: string, missed: "once" | "skip") {
  const ctx = createCtx({ mode: "sim", seed: 4242 });
  const jobs = { ...orders };
  const keys: string[] = [];
  const orig = jobs.enqueue.bind(jobs);
  vi.spyOn(jobs, "enqueue").mockImplementation((c, id, input, opts) => {
    keys.push(String(opts?.key));
    return orig(c, id, input, opts);
  });
  const table = { "orders.sched": { cron, zone: "UTC", job: "orders.digest", input: {}, missed } } as const;
  ctx.clock.advance(T0);
  let current: { ac: AbortController; done: Promise<void> } | undefined;
  const start = async () => {
    const ac = new AbortController();
    current = { ac, done: schedule(jobs, table).run(ctx, ac.signal) };
    await settle();
  };
  const stop = async () => {
    if (current === undefined) return;
    current.ac.abort();
    await current.done.catch(() => undefined);
    current = undefined;
  };
  const advance = async (ms: number) => {
    ctx.clock.advance(ms);
    await settle();
  };
  // Time passes minute by minute while the runner is up.
  const tick = async (minutes: number) => {
    for (let i = 0; i < minutes; i++) await advance(MIN);
  };
  const fireTime = (key: string) => Number(key.split("@")[1]);
  return { ctx, keys, start, stop, advance, tick, fireTime };
}

const noRepeats = (keys: readonly string[]) => expect(new Set(keys).size).toBe(keys.length);

test("(a) one jump over ten missed minute fires: 'once' enqueues exactly one job, for the latest", async () => {
  const f = fixture("* * * * *", "once");
  await f.start();
  await f.tick(2);
  const before = f.keys.length;
  await f.stop();
  const downFrom = f.ctx.clock.now();
  await f.advance(10 * MIN);
  expect(f.keys.length).toBe(before);
  await f.start();
  const caught = f.keys.slice(before);
  expect(caught.length).toBe(1);
  const latest = Math.floor(f.ctx.clock.now() / MIN) * MIN;
  expect(f.fireTime(caught[0] ?? "")).toBe(latest);
  expect(latest).toBeGreaterThan(downFrom);
  noRepeats(f.keys);
  await f.stop();
});

test("(a) 'skip' enqueues no catch-up job after the same jump", async () => {
  const f = fixture("* * * * *", "skip");
  await f.start();
  await f.tick(2);
  const before = f.keys.length;
  await f.stop();
  await f.advance(10 * MIN);
  await f.start();
  expect(f.keys.length).toBe(before);
  await f.tick(1);
  expect(f.keys.length).toBe(before + 1);
  noRepeats(f.keys);
  await f.stop();
});

test("(b) ticks and runs after the catch-up do not refire it", async () => {
  const f = fixture("* * * * *", "once");
  await f.start();
  await f.tick(1);
  await f.stop();
  await f.advance(10 * MIN);
  await f.start();
  const afterCatchUp = f.keys.length;
  await f.advance(0);
  await f.advance(10_000);
  expect(f.keys.length).toBe(afterCatchUp);
  await f.tick(5);
  expect(f.keys.length).toBe(afterCatchUp + 5);
  noRepeats(f.keys);
  await f.stop();
});

test("(c) a daily schedule across a multi-day downtime catches up once, then fires daily", async () => {
  const f = fixture("0 3 * * *", "once");
  await f.start();
  await f.advance(DAY);
  const before = f.keys.length;
  expect(before).toBe(1);
  await f.stop();
  await f.advance(4 * DAY);
  await f.start();
  expect(f.keys.length).toBe(before + 1);
  const latest = Math.floor((f.ctx.clock.now() - 3 * 60 * MIN) / DAY) * DAY + 3 * 60 * MIN;
  expect(f.fireTime(f.keys[before] ?? "")).toBe(latest);
  await f.advance(DAY);
  expect(f.keys.length).toBe(before + 2);
  noRepeats(f.keys);
  await f.stop();
});

test("(d) a new runner over the same storage after the catch-up does not refire", async () => {
  const f = fixture("* * * * *", "once");
  await f.start();
  await f.tick(1);
  await f.stop();
  await f.advance(10 * MIN);
  await f.start();
  const afterCatchUp = f.keys.length;
  await f.stop();
  await f.start();
  expect(f.keys.length).toBe(afterCatchUp);
  await f.stop();
  await f.advance(10_000);
  await f.start();
  expect(f.keys.length).toBe(afterCatchUp);
  await f.stop();
});

test("no fire key repeats across two downtimes of random length; each yields at most one catch-up fire", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.integer({ min: 2, max: 90 }),
      fc.integer({ min: 2, max: 90 }),
      fc.integer({ min: 0, max: 5 }),
      async (down1, down2, up) => {
        const f = fixture("* * * * *", "once");
        await f.start();
        await f.tick(up + 1);
        await f.stop();
        const n0 = f.keys.length;
        await f.advance(down1 * MIN);
        await f.start();
        expect(f.keys.length).toBe(n0 + 1);
        await f.tick(up);
        const n1 = f.keys.length;
        expect(n1).toBe(n0 + 1 + up);
        await f.stop();
        await f.advance(down2 * MIN);
        await f.start();
        expect(f.keys.length).toBe(n1 + 1);
        await f.stop();
        await f.start();
        expect(f.keys.length).toBe(n1 + 1);
        noRepeats(f.keys);
        const times = f.keys.map(f.fireTime);
        expect([...times].sort((x, y) => x - y)).toEqual(times);
        await f.stop();
      },
    ),
    { seed: 4242, numRuns: 25 },
  );
});
