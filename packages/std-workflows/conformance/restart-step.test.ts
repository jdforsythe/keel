// Spec: std.workflows, Conformance "After `close()` while `run` is pending, a new `createApp` on the same ctx runs it again with the same `key`, and the instance takes its `done` event once."
// Seed: 1337.
// Assumption: as for std.jobs restart, `close()` frees the lease, and the clock is also moved past `timeoutMs` plus 1,000 ms so a lease that was not freed has ended; the second `createApp` needs no `routes`.
import { ok } from "@keel/schema";
import { expect, test } from "vitest";
import { begin, boot, close, makeFlow, pass, readRows, settle, sim, start } from "./fixtures.ts";

test("After `close()` while `run` is pending, a new `createApp` on the same ctx runs it again with the same `key`, and the instance takes its `done` event once.", async () => {
  const ctx = sim();
  const keys: string[] = [];
  const f = makeFlow({
    timeoutMs: 60_000,
    run: (_data, _ctx, { key }) => {
      keys.push(key);
      return keys.length === 1 ? new Promise(() => undefined) : Promise.resolve(ok({ freed: 2 }));
    },
  });
  const first = await boot(ctx, f);
  const id = ctx.random.id("Flow");
  await start(ctx, f, id, { n: 1, freed: 0, code: "" });
  const entered = await begin(ctx, f, id);
  await settle();
  expect(keys).toHaveLength(1);
  expect((await readRows(ctx, f))[id]?.state).toBe("purging");
  await close(first);
  const second = await boot(ctx, f);
  await settle();
  await pass(ctx, 62_000);
  expect(keys).toHaveLength(2);
  expect(keys[1]).toBe(keys[0]);
  expect(keys[0]).toBe(`${id}:${f.id}:${entered}`);
  const row = (await readRows(ctx, f))[id];
  expect(row?.state).toBe("purged");
  expect(row?.data.freed).toBe(2);
  expect(row?.entered).toBe(entered + 1);
  await pass(ctx, 120_000);
  expect(keys).toHaveLength(2);
  expect((await readRows(ctx, f))[id]?.entered).toBe(entered + 1);
  await close(second);
});
