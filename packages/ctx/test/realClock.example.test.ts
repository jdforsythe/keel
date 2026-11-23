// A real ctx's clock: `after` waits on the platform timer, rejects a bad delay, and an abort ends the wait and its timer.
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createCtx } from "../src/index.ts";

const clock = (): ReturnType<typeof createCtx>["clock"] => createCtx({ mode: "real", seed: 1 }).clock;

/** Settles to how `p` ended, without waiting on a timer. */
async function outcome(p: Promise<unknown>): Promise<unknown> {
  let state: unknown = "pending";
  p.then(
    () => {
      state = "resolved";
    },
    (reason: unknown) => {
      state = { rejected: reason };
    },
  );
  await vi.advanceTimersByTimeAsync(0);
  return state;
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("real clock", () => {
  test("now reads the wall clock", () => {
    vi.setSystemTime(1_700_000_000_000);
    expect(clock().now()).toBe(1_700_000_000_000);
  });

  test("after resolves once its delay has passed, not before", async () => {
    const wait = clock().after(1000);
    await vi.advanceTimersByTimeAsync(999);
    expect(await outcome(wait)).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome(wait)).toBe("resolved");
  });

  test.each([-1, Number.NaN, Number.POSITIVE_INFINITY])(
    "after(%s) rejects with a RangeError and sets no timer",
    async (ms) => {
      const state = await outcome(clock().after(ms));
      expect(state).toEqual({ rejected: expect.any(RangeError) });
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  test("a signal already aborted rejects with its reason and sets no timer", async () => {
    const reason = new Error("stopped before");
    const state = await outcome(clock().after(1000, AbortSignal.abort(reason)));
    expect(state).toEqual({ rejected: reason });
    expect(vi.getTimerCount()).toBe(0);
  });

  test("an abort during the wait rejects with the signal's reason and clears the timer", async () => {
    const stop = new AbortController();
    const wait = clock().after(1000, stop.signal);
    expect(vi.getTimerCount()).toBe(1);
    const reason = new Error("stopped during");
    stop.abort(reason);
    expect(await outcome(wait)).toEqual({ rejected: reason });
    expect(vi.getTimerCount()).toBe(0);
  });

  test("a finished wait leaves no listener on its signal", async () => {
    const stop = new AbortController();
    const added: unknown[][] = [];
    const removed: unknown[][] = [];
    vi.spyOn(stop.signal, "addEventListener").mockImplementation((...args: unknown[]) => void added.push(args));
    vi.spyOn(stop.signal, "removeEventListener").mockImplementation((...args: unknown[]) => void removed.push(args));
    const wait = clock().after(10, stop.signal);
    await vi.advanceTimersByTimeAsync(10);
    expect(await outcome(wait)).toBe("resolved");
    expect(added).toHaveLength(1);
    expect(added[0]?.[0]).toBe("abort");
    expect(removed.map((r) => r.slice(0, 2))).toEqual([added[0]?.slice(0, 2)]);
  });

  test("a delay past what the platform timer holds waits for the longest delay it holds", async () => {
    const stop = new AbortController();
    const wait = clock().after(2 ** 31 + 5, stop.signal);
    await vi.advanceTimersByTimeAsync(2 ** 31 - 2);
    expect(await outcome(wait)).toBe("pending");
    await vi.advanceTimersByTimeAsync(1);
    expect(await outcome(wait)).toBe("resolved");
  });
});
