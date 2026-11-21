// Connectivity: sim `setOnline`, relayed bodies, real `online()` and its window events. Seed 1337.
import fc from "fast-check";
import { afterEach, describe, expect, test, vi } from "vitest";
import { type CtxEvent, createCtx, observe } from "../src/index.ts";

afterEach(() => {
  vi.unstubAllGlobals();
});

const URL_A = "https://net.example.test/a";

function netEvents(ctx: Parameters<typeof observe>[0]): CtxEvent[] {
  const seen: CtxEvent[] = [];
  observe(ctx, (e) => {
    if (e.kind === "net") seen.push(e);
  });
  return seen;
}

async function rejection(p: Promise<unknown>): Promise<unknown> {
  try {
    await p;
  } catch (reason) {
    return reason;
  }
  throw new Error("expected a rejection");
}

describe("sim net connectivity", () => {
  test("any series of setOnline calls reports one event per change and none for a repeat", () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { maxLength: 20 }), (calls) => {
        const ctx = createCtx({ mode: "sim", seed: 1337 });
        const seen = netEvents(ctx);
        const want: CtxEvent[] = [];
        let up = true;
        for (const online of calls) {
          ctx.net.setOnline(online);
          if (online !== up) want.push({ kind: "net", online });
          up = online;
          expect(ctx.net.online()).toBe(online);
        }
        expect(seen).toEqual(want);
      }),
      { seed: 1337, numRuns: 100 },
    );
  });

  test("a relayed body keeps the route's status, headers and bytes", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(URL_A, () => new Response("hello", { status: 201, statusText: "Made", headers: { "x-a": "1" } }));
    const res = await ctx.net.fetch(new Request(URL_A));
    expect([res.status, res.statusText, res.headers.get("x-a")]).toEqual([201, "Made", "1"]);
    expect(await res.text()).toBe("hello");
  });

  test("a body read to its end, or cancelled, is not errored by a later offline", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(URL_A, () => new Response("done"));
    const read = await ctx.net.fetch(new Request(URL_A));
    const cancelled = await ctx.net.fetch(new Request(URL_A));
    expect(await read.text()).toBe("done");
    await cancelled.body?.cancel();
    ctx.net.setOnline(false);
    expect(read.bodyUsed).toBe(true);
  });

  test("a response without a body passes through, and a 404 is not relayed", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(URL_A, () => new Response(null, { status: 204 }));
    expect((await ctx.net.fetch(new Request(URL_A))).status).toBe(204);
    const missing = await ctx.net.fetch(new Request("https://net.example.test/none"));
    expect(missing.status).toBe(404);
  });

  test("a handler that answers after the net went offline rejects with a TypeError", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    const gate: { open?: () => void } = {};
    ctx.net.route(URL_A, async () => {
      await new Promise<void>((resolve) => {
        gate.open = resolve;
      });
      return new Response("late");
    });
    const pending = ctx.net.fetch(new Request(URL_A));
    await Promise.resolve();
    ctx.net.setOnline(false);
    gate.open?.();
    expect(await rejection(pending)).toBeInstanceOf(TypeError);
  });

  test("an open body errors with a TypeError when the net goes offline", async () => {
    const ctx = createCtx({ mode: "sim", seed: 1337 });
    ctx.net.route(URL_A, () => new Response(new ReadableStream<Uint8Array>({ start() {} })));
    const res = await ctx.net.fetch(new Request(URL_A));
    const reader = res.body?.getReader();
    const next = reader?.read();
    ctx.net.setOnline(false);
    expect(await rejection(next ?? Promise.resolve())).toBeInstanceOf(TypeError);
  });
});

describe("real net connectivity", () => {
  test("a window event reports a change to observe once, and nothing when online() did not change", () => {
    const nav = { onLine: true };
    const win = new EventTarget();
    vi.stubGlobal("navigator", nav);
    vi.stubGlobal("window", win);
    const ctx = createCtx({ mode: "real", seed: 1337 });
    const seen = netEvents(ctx);
    win.dispatchEvent(new Event("online"));
    nav.onLine = false;
    win.dispatchEvent(new Event("offline"));
    win.dispatchEvent(new Event("offline"));
    nav.onLine = true;
    win.dispatchEvent(new Event("online"));
    expect(seen).toEqual([
      { kind: "net", online: false },
      { kind: "net", online: true },
    ]);
  });

  test("a navigator without onLine counts as online", () => {
    vi.stubGlobal("navigator", {});
    expect(createCtx({ mode: "shell", seed: 1337 }).net.online()).toBe(true);
  });
});
