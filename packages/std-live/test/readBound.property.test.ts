// Property and examples: a std.live read is pending until it settles or 30 s pass on ctx.clock. For any schedule of
// settle times on either side of the bound, and any events, one read is pending at a time, only reads settled within
// 30 s commit, a read given up or pending at dispose has an aborted signal, each at most once and in start order, and no clock wait outlives the scope. Seed 1337.
import { type KeelError, type Result, ok } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import { mount, server, settle } from "./helpers.ts";

type Settle = (r: Result<number, KeelError<string, unknown>>) => void;
interface Started {
  readonly at: number;
  readonly done: Settle;
  readonly signal: AbortSignal;
  settledAt: number | null;
}

/** A read the test settles by hand; read `i` returns `ok(i)`. */
function held(now: () => number) {
  const reads: Started[] = [];
  const read = (_ctx: unknown, signal: AbortSignal): Promise<Result<number, KeelError<string, unknown>>> =>
    new Promise((done) => {
      reads.push({ at: now(), done, signal, settledAt: null });
    });
  const settleRead = (i: number): void => {
    const r = reads[i];
    if (r === undefined || r.settledAt !== null) return;
    r.settledAt = now();
    r.done(ok(i));
  };
  return { reads, read, settleRead };
}

const committed = (view: { log(): readonly { payload: unknown }[] }): number[] =>
  view.log().map((e) => (typeof e.payload === "number" ? e.payload : -1));

test("a read settled in time leaves no clock wait behind", async () => {
  const { ctx } = server();
  const h = held(() => ctx.clock.now());
  const m = mount(ctx, h.read);
  await settle();
  expect(ctx.clock.next()).toBe(30_000);
  h.settleRead(0);
  await settle();
  expect(m.status()).toBe("live");
  expect(ctx.clock.next()).toBeNull();
  m.dispose();
});

test("disposing during a pending read ends its wait, and the late result commits nothing", async () => {
  const { ctx } = server();
  const h = held(() => ctx.clock.now());
  const m = mount(ctx, h.read);
  await settle();
  m.dispose();
  await settle();
  expect(ctx.clock.next()).toBeNull();
  h.settleRead(0);
  await settle();
  expect(committed(m.view)).toEqual([]);
});

test("a read given up at 30 s changes nothing when it settles, even before the retry", async () => {
  const { ctx } = server();
  const h = held(() => ctx.clock.now());
  const m = mount(ctx, h.read);
  await settle();
  ctx.clock.advance(30_000);
  await settle();
  expect(m.status()).toBe("connecting");
  h.settleRead(0);
  await settle();
  expect(committed(m.view)).toEqual([]);
  expect(m.status()).toBe("connecting");
  expect(h.reads).toHaveLength(1);
  ctx.clock.advance(1000);
  await settle();
  expect(h.reads).toHaveLength(2);
  h.settleRead(1);
  await settle();
  expect(committed(m.view)).toEqual([1]);
  expect(m.status()).toBe("live");
  m.dispose();
});

const delayArb = fc.oneof(
  fc.integer({ min: 0, max: 29 }).map((s) => s * 1000),
  fc.integer({ min: 31, max: 60 }).map((s) => s * 1000),
  fc.constant(null),
);

test("for any settle schedule around the bound, only reads settled within 30 s commit, once each and in order", async () => {
  await fc.assert(
    fc.asyncProperty(
      fc.array(delayArb, { minLength: 1, maxLength: 10 }),
      fc.array(fc.boolean(), { minLength: 60, maxLength: 120 }),
      async (delays, events) => {
        const { ctx, emit } = server();
        const h = held(() => ctx.clock.now());
        const m = mount(ctx, h.read);
        await settle();
        let pendingAtStart = 0;
        let seen = 0;
        for (const ev of events) {
          if (ev) emit({ kind: "saved", store: "board", head: 1 });
          await settle();
          ctx.clock.advance(1000);
          await settle();
          const now = ctx.clock.now();
          h.reads.forEach((r, i) => {
            const d = i < delays.length ? delays[i] : 0;
            if (d !== null && d !== undefined && now - r.at >= d) h.settleRead(i);
          });
          await settle();
          for (; seen < h.reads.length; seen++) {
            const start = h.reads[seen];
            if (start === undefined) continue;
            pendingAtStart += h.reads
              .slice(0, seen)
              .filter((r) => (r.settledAt === null || r.settledAt > start.at) && start.at < r.at + 30_000).length;
          }
        }
        expect(pendingAtStart).toBe(0);
        const tags = committed(m.view);
        expect(new Set(tags).size).toBe(tags.length);
        expect([...tags].sort((a, b) => a - b)).toEqual(tags);
        for (const i of tags) {
          const r = h.reads[i];
          expect(r?.settledAt ?? null).not.toBeNull();
          if (r !== undefined && r.settledAt !== null) expect(r.settledAt - r.at).toBeLessThan(30_000);
        }
        for (const r of h.reads) {
          if (r.settledAt === null && ctx.clock.now() - r.at >= 30_000) expect(r.signal.aborted).toBe(true);
        }
        m.dispose();
        await settle();
        for (const r of h.reads) if (r.settledAt === null) expect(r.signal.aborted).toBe(true);
        expect(ctx.clock.next()).toBeNull();
      },
    ),
    { seed: 1337, numRuns: 60 },
  );
});
