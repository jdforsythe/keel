import { createCtx } from "@keel/ctx";
import fc from "fast-check";
// k.ctx: clock.after(ms, signal) under sim resolves exactly when advance crosses the deadline
import { describe, expect, test } from "vitest";

const SEED = 1337;

function sim() {
  return createCtx({ mode: "sim", seed: SEED }).clock;
}

/** Resolves on the next microtask turns; lets already-settled promises run their handlers. */
async function flush(): Promise<void> {
  for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("k.ctx clock.after (sim)", () => {
  test("never resolves before the deadline, resolves when advance reaches it", async () => {
    const c = sim();
    let done = false;
    void c.after(100).then(() => {
      done = true;
    });
    c.advance(99);
    await flush();
    expect(done).toBe(false);
    c.advance(1);
    await flush();
    expect(done).toBe(true);
  });

  test("after(0) resolves without advancing", async () => {
    await expect(sim().after(0)).resolves.toBeUndefined();
  });

  test("due waiters resolve in deadline order, ties by registration order", async () => {
    const c = sim();
    const order: string[] = [];
    const wait = (name: string, ms: number) => c.after(ms).then(() => void order.push(name));
    const all = Promise.all([wait("a", 50), wait("b", 10), wait("c", 50), wait("d", 30)]);
    c.advance(100);
    await all;
    expect(order).toEqual(["b", "d", "a", "c"]);
  });

  test("a single advance resolves all due waiters before it returns", async () => {
    const c = sim();
    const seen: number[] = [];
    const p = c.after(5).then(() => void seen.push(c.now()));
    c.advance(10);
    await p;
    expect(seen).toHaveLength(1);
  });

  test("abort rejects with the abort reason and the waiter never fires", async () => {
    const c = sim();
    const ac = new AbortController();
    const reason = new Error("stop");
    const p = c.after(100, ac.signal);
    ac.abort(reason);
    await expect(p).rejects.toBe(reason);
    c.advance(200);
    await flush();
  });

  test("an already aborted signal rejects", async () => {
    const reason = new Error("early");
    await expect(sim().after(10, AbortSignal.abort(reason))).rejects.toBe(reason);
  });

  test("aborting one waiter leaves others intact", async () => {
    const c = sim();
    const ac = new AbortController();
    const dead = c.after(10, ac.signal);
    const live = c.after(20);
    ac.abort();
    await expect(dead).rejects.toBeDefined();
    c.advance(20);
    await expect(live).resolves.toBeUndefined();
  });

  test("property: waiters resolve exactly when cumulative advance reaches their deadline", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.integer({ min: 0, max: 500 }), { minLength: 1, maxLength: 8 }),
        fc.array(fc.integer({ min: 0, max: 300 }), { maxLength: 10 }),
        async (delays, steps) => {
          const c = sim();
          const fired: number[] = [];
          delays.forEach((d, i) => void c.after(d).then(() => void fired.push(i)));
          let total = 0;
          for (const s of steps) {
            c.advance(s);
            total += s;
            await flush();
            const due = delays.map((d, i) => [d, i] as const).filter(([d]) => d <= total);
            expect(new Set(fired)).toEqual(new Set(due.map(([, i]) => i)));
          }
          await flush();
          const expected = delays
            .map((d, i) => [d, i] as const)
            .filter(([d]) => d <= total)
            .sort((x, y) => x[0] - y[0] || x[1] - y[1])
            .map(([, i]) => i);
          expect(fired).toEqual(expected);
        },
      ),
      { seed: SEED },
    );
  });
});
