// Spec: std.jobs, clause "After `close()` while `fn` is pending, a new `createApp` on the same ctx runs that job again; a job finished before `close()` never runs again; a pending one runs after the new start."
// Seed 1337
// Assumption: `createApp` needs no `routes` for a deployable whose module only has runners (`@keel/router` is not a dependency of this package).
import { createCtx } from "@keel/ctx";
import { createApp, topology } from "@keel/server";
import { job, queue } from "@keel/std-jobs";
import { ok, s } from "@keel/schema";
import { expect, test } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const input = s.object({ n: s.number() });

type Ctx = ReturnType<typeof createCtx>;
type Jobs = ReturnType<typeof queue>;
const boot = (ctx: Ctx, jobs: Jobs) =>
  createApp({
    topology: topology({ web: { modules: ["orders"], adapter: "node" } }),
    ctx,
    mode: "dev",
    runners: { orders: [jobs] },
  });
// ServerApp.close() is part of the runner contract (k.topology); read it without a cast.
const close = async (app: unknown): Promise<void> => {
  const f: unknown = Reflect.get(Object(app), "close");
  if (typeof f !== "function") throw new Error("ServerApp.close is missing");
  await Reflect.apply(f, app, []);
};

test("After `close()` while `fn` is pending, a new `createApp` on the same ctx runs that job again.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  let calls = 0;
  const work = job({ input }, () => {
    calls++;
    return new Promise(() => undefined);
  });
  const jobs = queue({ "orders.work": work });
  const first = await boot(ctx, jobs);
  await jobs.enqueue(ctx, "orders.work", { n: 1 });
  await settle();
  expect(calls).toBe(1);
  await close(first);
  const second = await boot(ctx, jobs);
  await settle();
  expect(calls).toBe(2);
  await close(second);
});

test("A job finished before `close()` never runs again.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  let calls = 0;
  const work = job({ input }, async () => {
    calls++;
    return ok(null);
  });
  const jobs = queue({ "orders.work": work });
  const first = await boot(ctx, jobs);
  await jobs.enqueue(ctx, "orders.work", { n: 1 });
  await settle();
  expect(calls).toBe(1);
  await close(first);
  const second = await boot(ctx, jobs);
  await settle();
  ctx.clock.advance(10_000_000);
  await settle();
  expect(calls).toBe(1);
  await close(second);
});

test("A job pending at `close()` runs after the new start.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const at: number[] = [];
  const work = job({ input }, async () => {
    at.push(ctx.clock.now());
    return ok(null);
  });
  const jobs = queue({ "orders.work": work });
  const first = await boot(ctx, jobs);
  await jobs.enqueue(ctx, "orders.work", { n: 1 }, { delayMs: 5000 });
  await settle();
  await close(first);
  ctx.clock.advance(7000);
  const second = await boot(ctx, jobs);
  await settle();
  expect(at.length).toBe(1);
  await close(second);
});

test("When the runner's `signal` aborts no job starts, and running ones get their `signal` aborted and their leases freed.", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  let signalSeen: AbortSignal | undefined;
  let calls = 0;
  const work = job({ input }, (_input, _ctx, signal) => {
    calls++;
    signalSeen = signal;
    return new Promise(() => undefined);
  });
  const jobs = queue({ "orders.work": work });
  const ac = new AbortController();
  const running = jobs.run(ctx, ac.signal);
  await jobs.enqueue(ctx, "orders.work", { n: 1 });
  await jobs.enqueue(ctx, "orders.work", { n: 2 }, { delayMs: 100 });
  await settle();
  expect(calls).toBe(1);
  ac.abort();
  await running.catch(() => undefined);
  expect(signalSeen?.aborted).toBe(true);
  ctx.clock.advance(1000);
  await settle();
  expect(calls).toBe(1);
});
