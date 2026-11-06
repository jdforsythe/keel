// Properties of resource. fast-check seed 1337.
import * as fc from "fast-check";
import { describe, expect, it } from "vitest";
import { effect, resource, scope } from "../src/index.ts";

const SEED = 1337;

const flush = async (): Promise<void> => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

interface Pending {
  promise: Promise<number>;
  resolve(v: number): void;
  reject(e: unknown): void;
}
const pending = (): Pending => {
  let resolve: (v: number) => void = () => {};
  let reject: (e: unknown) => void = () => {};
  const promise = new Promise<number>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("resource properties", () => {
  it("for any refetch count and settle order, only the latest request settles and transitions stay legal", async () => {
    const caseArb = fc
      .tuple(fc.integer({ min: 1, max: 6 }), fc.array(fc.boolean(), { minLength: 6, maxLength: 6 }))
      .chain(([n, fails]) =>
        fc.record({
          order: fc.shuffledSubarray([...Array(n).keys()], { minLength: n, maxLength: n }),
          fails: fc.constant(fails),
        }),
      );
    await fc.assert(
      fc.asyncProperty(caseArb, async ({ order, fails }) => {
        const reqs = order.map(() => pending());
        let i = 0;
        const states: string[] = [];
        let read: () => { state: string } = () => ({ state: "" });
        let refetch: () => void = () => {};
        const h = scope(() => {
          const r = resource(() => {
            const p = reqs[i++];
            return p ? p.promise : Promise.reject(new Error("unexpected fetch"));
          });
          read = () => r.get();
          refetch = () => r.refetch();
          effect(() => {
            states.push(r.get().state);
          });
        });
        for (let k = 1; k < reqs.length; k++) refetch();
        const latest = reqs.length - 1;
        for (const k of order) {
          const p = reqs[k];
          if (fails[k]) p?.reject(new Error(`e${k}`));
          else p?.resolve(k);
          await flush();
          if (k !== latest && order.indexOf(latest) > order.indexOf(k)) expect(read()).toEqual({ state: "loading" });
        }
        const final = read();
        if (fails[latest]) expect(final).toMatchObject({ state: "error" });
        else expect(final).toEqual({ state: "ready", value: latest });
        const seq = states.filter((s, k) => s !== states[k - 1]);
        expect(seq).toEqual(["loading", final.state]);
        h.dispose();
      }),
      { seed: SEED, numRuns: 100 },
    );
  });
});
