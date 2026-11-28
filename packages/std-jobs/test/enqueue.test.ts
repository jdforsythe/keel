// std.jobs API: "`enqueue` parses `input` with the job's schema (fail: `err` `keel.fields`), stores
// `{ id, job, input, at: now + delayMs, attempt: 0 }` under `ctx.storage` key `std.jobs.<module>`". Seed 1337
import { createCtx } from "@keel/ctx";
import { isDefect, ok, s } from "@keel/schema";
import { expect, test } from "vitest";
import { job, queue } from "../src/index.ts";

const jobs = () => queue({ "orders.work": job({ input: s.object({ n: s.int() }) }, async () => ok(null)) });

test("An input that does not parse is `keel.fields` naming its path, and nothing is stored", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  const bad: { n: number } = { n: 1.5 };
  const r = await jobs().enqueue(ctx, "orders.work", bad);
  expect(r).toMatchObject({ ok: false, error: { code: "keel.fields", data: { n: "int" } } });
  expect(await ctx.storage.get("std.jobs.orders")).toBeNull();
});

test("A job is stored under `std.jobs.<module>` with its encoded input, `at` and no run counted", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  ctx.clock.advance(40);
  const r = await jobs().enqueue(ctx, "orders.work", { n: 7 }, { delayMs: 500 });
  expect(r.ok).toBe(true);
  const stored: unknown = JSON.parse((await ctx.storage.get("std.jobs.orders")) ?? "null");
  expect(stored).toEqual({
    q: [{ id: r.ok ? r.value : "", job: "orders.work", input: { n: 7 }, at: 540, n: 0, l: 0 }],
    done: [],
    failed: [],
  });
});

test("A stored value that is not a queue rejects instead of dropping jobs", async () => {
  const ctx = createCtx({ mode: "sim", seed: 1337 });
  await ctx.storage.set("std.jobs.orders", JSON.stringify({ q: "nope" }));
  const caught = await jobs()
    .enqueue(ctx, "orders.work", { n: 1 })
    .catch((e: unknown) => e);
  expect(isDefect(caught)).toBe(true);
  expect(Reflect.get(Object(caught), "data")).toEqual({ key: "std.jobs.orders" });
});
