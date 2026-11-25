// Spec: std.schedules, clause "`schedule` throws E2554 for a `job` absent from `queue`, one of another module, and an `input` its job's schema refuses." (rfc:0092 A9)
// std.schedules, rule E2554: a `schedule` entry's `job` or `input` refused (thrown by `schedule`).
// std.schedules, Run: "on `ok` stores `t` as the entry's mark ... An `err` stores no mark and rejects `run`, which k.topology runs again." (rfc:0092 A9; no Conformance sentence, tested here)
// Seed 1337
// Assumption: a refused entry is built through `Reflect.apply` so the type system does not stop the call; a fire is observed by spying `jobs.enqueue` and the mark by spying `ctx.storage.set`.
import { createCtx } from "@keel/ctx";
import { err, ok, s } from "@keel/schema";
import { job, queue } from "@keel/std-jobs";
import { schedule } from "@keel/std-schedules";
import fc from "fast-check";
import { expect, test, vi } from "vitest";

const settle = async () => {
  for (let i = 0; i < 200; i++) await Promise.resolve();
};
const word = fc.stringMatching(/^[a-z]{3,10}$/);
const digest = job({ input: s.object({ id: s.string() }) }, async () => ok(null));
const charge = job({ input: s.object({}) }, async () => ok(null));
const jobs = queue({ "orders.digest": digest, "billing.charge": charge });
const build = (table: unknown): unknown => Reflect.apply(schedule, undefined, [jobs, table]);
const entry = (job: string, input: unknown) => ({ cron: "0 3 * * *", zone: "UTC", job, input });

test("`schedule` throws E2554 for a `job` absent from `queue`.", () => {
  fc.assert(
    fc.property(word, (name) => {
      expect(() => build({ "orders.x": entry(`orders.${name}x`, {}) })).toThrow(/E2554/);
    }),
    { seed: 1337, numRuns: 20 },
  );
});

test("`schedule` throws E2554 for a `job` of another module.", () => {
  expect(() => build({ "orders.x": entry("billing.charge", {}) })).toThrow(/E2554/);
});

test("`schedule` throws E2554 for an `input` its job's schema refuses.", () => {
  fc.assert(
    fc.property(
      fc.oneof(fc.integer(), fc.constant(null), fc.constant({}), fc.record({ id: fc.integer() })),
      (input) => {
        expect(() => build({ "orders.x": entry("orders.digest", input) })).toThrow(/E2554/);
      },
    ),
    { seed: 1337, numRuns: 30 },
  );
});

test("E2554 is not thrown for a `job` of the queue and its module with an `input` its schema accepts.", () => {
  fc.assert(
    fc.property(word, word, (name, id) => {
      expect(() => build({ [`orders.${name}`]: entry("orders.digest", { id }) })).not.toThrow();
    }),
    { seed: 1337, numRuns: 20 },
  );
});

const T = Date.parse("2026-11-10T02:59:00.000Z");
async function fireOnce(enqueue: "ok" | "err") {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  if (enqueue === "err")
    vi.spyOn(jobs, "enqueue").mockImplementation(async () => err({ code: "keel.busy", message: "busy", data: null }));
  const marks: string[] = [];
  const set = ctx.storage.set.bind(ctx.storage);
  vi.spyOn(ctx.storage, "set").mockImplementation((k, v) => {
    if (k.startsWith("std.schedules.")) marks.push(k);
    return set(k, v);
  });
  ctx.clock.advance(T);
  const ac = new AbortController();
  const outcome = schedule(jobs, {
    "orders.nightly": { cron: "0 3 * * *", zone: "UTC", job: "orders.digest", input: { id: "a" } },
  })
    .run(ctx, ac.signal)
    .then(
      () => "resolved",
      (e: unknown) => e,
    );
  await settle();
  ctx.clock.advance(60_000);
  await settle();
  ac.abort();
  const result = await outcome;
  vi.restoreAllMocks();
  return { marks, result };
}

test("A fire stores its mark in `ctx.storage` key `std.schedules.<module>` after `enqueue` returns `ok`.", async () => {
  const { marks } = await fireOnce("ok");
  expect(marks).toEqual(["std.schedules.orders", "std.schedules.orders"]);
});

test("An `err` from `enqueue` stores no mark and rejects `run`.", async () => {
  const { marks, result } = await fireOnce("err");
  expect(marks).toEqual(["std.schedules.orders"]);
  expect(result).not.toBe("resolved");
});
