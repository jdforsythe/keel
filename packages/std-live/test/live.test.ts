import { scope } from "@keel/reactive";
// Examples for std.live clauses no conformance sentence covers. Seed 1337.
import { type KeelError, type Result, err, ok, s } from "@keel/schema";
import { channel } from "@keel/std-channels";
import { type Transaction, store, transaction } from "@keel/store";
import { expect, test } from "vitest";
import { live } from "../src/index.ts";
import { ORIGIN, mount, server, settle } from "./helpers.ts";

const boom: Result<number, KeelError<string, unknown>> = err({ code: "x.boom", message: "boom", data: {} });

test("a failed read runs again at the next event, before its retry timer", async () => {
  const { ctx, emit } = server();
  const at: number[] = [];
  const m = mount(ctx, async (c) => {
    at.push(c.clock.now());
    return at.length === 1 ? boom : ok(at.length);
  });
  await settle();
  expect(at).toEqual([0]);
  expect(m.status()).toBe("connecting");
  ctx.clock.advance(400);
  emit({ kind: "saved", store: "board", head: 1 });
  await settle();
  expect(at).toEqual([0, 400]);
  expect(m.status()).toBe("live");
  ctx.clock.advance(5000);
  await settle();
  expect(at).toHaveLength(2);
  m.dispose();
});

test("status is denied once the channel denies, and no read follows", async () => {
  const { ctx, emit } = server();
  let reads = 0;
  const m = mount(ctx, async () => ok(++reads));
  await settle();
  expect(m.status()).toBe("live");
  emit({ kind: "closed", reason: "denied" });
  await settle();
  expect(m.status()).toBe("denied");
  ctx.clock.advance(100_000);
  await settle();
  expect(reads).toBe(1);
  m.dispose();
});

test("message events cause no read", async () => {
  const { ctx, emit } = server();
  let reads = 0;
  const m = mount(ctx, async () => ok(++reads));
  await settle();
  emit({ kind: "message", message: 1 });
  await settle();
  expect(reads).toBe(1);
  m.dispose();
});

test("live outside a scope throws E1203", () => {
  const { ctx } = server();
  const ch = channel("unit.other", { path: "/events", params: s.object({}) });
  const held: { hydrate?: Transaction<{ n: number }, number> } = {};
  const sc = scope(() => {
    const view = store(s.object({ n: s.int() }), { n: 0 }, { id: "unit.outside" });
    held.hydrate = transaction(view, "view.hydrate", s.int(), (_st, p) => ({ n: p }));
  });
  const hydrate = held.hydrate;
  if (hydrate === undefined) throw new Error("no hydrate");
  expect(() => live(ctx, ORIGIN, ch, {}, { read: async () => ok(1), hydrate })).toThrow(/^E1203/);
  sc.dispose();
});

test("status leaves live at a drop, stays connecting while the stream waits to reopen, and the reopen re-reads", async () => {
  const { ctx, drop } = server();
  const at: number[] = [];
  const m = mount(ctx, async (c) => {
    at.push(c.clock.now());
    return ok(at.length);
  });
  await settle();
  expect([at, m.status()]).toEqual([[0], "live"]);
  drop();
  await settle();
  expect(m.status()).toBe("connecting");
  await ctx.clock.advance(999);
  await settle();
  expect([at, m.status()]).toEqual([[0], "connecting"]);
  await ctx.clock.advance(1);
  await settle();
  expect([at, m.status(), m.view.log().at(-1)?.payload]).toEqual([[0, 1000], "live", 2]);
  m.dispose();
});
