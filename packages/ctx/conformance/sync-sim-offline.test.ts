// Spec: k.sync Conformance, "Under sim, after `setOnline(false)`, `online()` is false, `fetch` rejects with a `TypeError`, an open sim response body errors, and an observer gets one `{ kind: 'net', online: false }`; `setOnline(true)` reverses each."
// Seed 1337 (fast-check `seed: 1337`).
// ASSUMPTION (as the neighbouring conformance files): a sim route is `ctx.net.route(url, handler)` returning a standard Response.
import { createCtx, observe } from "@keel/ctx";
import type { CtxEvent } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const URL_A = "https://sync.example.test/a";
const URL_STREAM = "https://sync.example.test/stream";

function sim() {
  const ctx = createCtx({ mode: "sim", seed: SEED });
  ctx.net.route(URL_A, () => new Response("hello"));
  ctx.net.route(URL_STREAM, () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("first"));
      },
    });
    return new Response(body);
  });
  const events: CtxEvent[] = [];
  observe(ctx, (e) => {
    events.push(e);
  });
  const nets = () => events.filter((e) => e.kind === "net");
  return { ctx, events, nets };
}

async function settle(p: Promise<unknown>): Promise<{ ok: true; value: unknown } | { ok: false; reason: unknown }> {
  try {
    return { ok: true, value: await p };
  } catch (reason) {
    return { ok: false, reason };
  }
}

describe("k.sync: sim connectivity", () => {
  test("a sim ctx is online until `setOnline(false)`", () => {
    expect(sim().ctx.net.online()).toBe(true);
  });

  test("after `setOnline(false)`, `online()` is false", () => {
    const { ctx } = sim();
    ctx.net.setOnline(false);
    expect(ctx.net.online()).toBe(false);
  });

  test("after `setOnline(false)`, `fetch` rejects with a `TypeError`", async () => {
    const { ctx } = sim();
    ctx.net.setOnline(false);
    const r = await settle(ctx.net.fetch(new Request(URL_A)));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBeInstanceOf(TypeError);
  });

  test("after `setOnline(false)`, an open sim response body errors", async () => {
    const { ctx } = sim();
    const res = await ctx.net.fetch(new Request(URL_STREAM));
    if (res.body === null) throw new Error("the stream route returned no body");
    const reader = res.body.getReader();
    const first = await reader.read();
    expect(first.done).toBe(false);
    ctx.net.setOnline(false);
    const next = await settle(reader.read());
    expect(next.ok).toBe(false);
  });

  test("after `setOnline(false)`, an observer gets one `{ kind: 'net', online: false }`", () => {
    const { ctx, nets } = sim();
    ctx.net.setOnline(false);
    expect(nets()).toEqual([{ kind: "net", online: false }]);
  });

  test("`setOnline(true)` reverses `online()`, `fetch` and the event", async () => {
    const { ctx, nets } = sim();
    ctx.net.setOnline(false);
    ctx.net.setOnline(true);
    expect(ctx.net.online()).toBe(true);
    const res = await ctx.net.fetch(new Request(URL_A));
    expect(await res.text()).toBe("hello");
    expect(nets()).toEqual([
      { kind: "net", online: false },
      { kind: "net", online: true },
    ]);
  });

  test("`setOnline(true)` lets a new stream open and read again", async () => {
    const { ctx } = sim();
    ctx.net.setOnline(false);
    ctx.net.setOnline(true);
    const res = await ctx.net.fetch(new Request(URL_STREAM));
    if (res.body === null) throw new Error("the stream route returned no body");
    const first = await res.body.getReader().read();
    expect(first.done).toBe(false);
  });

  test("property: any alternating series of `setOnline` calls leaves `online()` as the last call and one event per change", () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 12 }), (n) => {
        const { ctx, nets } = sim();
        const want: boolean[] = [];
        for (let i = 0; i < n; i++) {
          const online = i % 2 === 1;
          ctx.net.setOnline(online);
          want.push(online);
          expect(ctx.net.online()).toBe(online);
        }
        expect(nets()).toEqual(want.map((online) => ({ kind: "net", online })));
      }),
      { seed: SEED, numRuns: 50 },
    );
  });

  test("a past `net` event is not replayed to a later observer", () => {
    const { ctx } = sim();
    ctx.net.setOnline(false);
    const late: CtxEvent[] = [];
    observe(ctx, (e) => {
      late.push(e);
    });
    expect(late.filter((e) => e.kind === "net")).toEqual([]);
  });

  test("two sim ctxs are independent: taking one offline leaves the other online", () => {
    const a = sim();
    const b = sim();
    a.ctx.net.setOnline(false);
    expect(b.ctx.net.online()).toBe(true);
    expect(b.nets()).toEqual([]);
  });
});
