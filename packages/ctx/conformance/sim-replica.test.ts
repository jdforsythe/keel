// Spec: k.sim, clause "With `b = replica(a)` of a sim ctx `a`: a value `set` through `a.storage` is what `b.storage.get` returns; `b.clock.now()` equals `a.clock.now()` after `advance(100)` on `a`'s clock; a capability accessor returns the same object for `a` and `b`; `replica` of a real ctx throws E1604."
// Seed: 1337.
// Reading: "advance(100) on a's clock" is `a.clock.advance(100)`; the clause also holds for any generated advance, and for a `set` through either side.
// Reading: `replica` is called through `Reflect.apply` for a real or shell ctx, whose type it may refuse.
import { createCtx, register, replica } from "@keel/ctx";
import fc from "fast-check";
import { describe, expect, test } from "vitest";

const SEED = 1337;
const FC = { seed: SEED, numRuns: 40 };
const never = () => {
  throw new Error("not the ctx's mode");
};

const codeOf = (e: unknown): unknown => (typeof e === "object" && e !== null && "code" in e ? e.code : undefined);
function thrownCode(make: () => unknown): unknown {
  try {
    make();
    return undefined;
  } catch (e) {
    return codeOf(e);
  }
}

interface Box {
  readonly id: number;
}
let counter = 0;
const fresh = (): string => `replica.data${counter++}`;

describe("k.sim: Replicas", () => {
  test("a value `set` through `a.storage` is what `b.storage.get` returns", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string({ maxLength: 8 }), fc.string({ maxLength: 8 }), async (key, value) => {
        const a = createCtx({ mode: "sim", seed: SEED });
        const b = replica(a);
        await a.storage.set(key, value);
        expect(await b.storage.get(key)).toBe(value);
        // and the other way: the data is one
        await b.storage.set(`${key}.b`, value);
        expect(await a.storage.get(`${key}.b`)).toBe(value);
        expect(await b.storage.get(`${key}.absent`)).toBeNull();
      }),
      FC,
    );
  });

  test("`b.clock.now()` equals `a.clock.now()` after `advance(100)` on `a`'s clock", () => {
    fc.assert(
      fc.property(fc.array(fc.integer({ min: 0, max: 500 }), { maxLength: 5 }), (steps) => {
        const a = createCtx({ mode: "sim", seed: SEED });
        const b = replica(a);
        a.clock.advance(100);
        expect(b.clock.now()).toBe(a.clock.now());
        for (const ms of steps) {
          a.clock.advance(ms);
          expect(b.clock.now()).toBe(a.clock.now());
        }
        b.clock.advance(7);
        expect(a.clock.now()).toBe(b.clock.now());
      }),
      FC,
    );
  });

  test("a capability accessor returns the same object for `a` and `b`", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 1_000_000 }), (seed) => {
        let made = 0;
        const access = register<Box>(fresh(), {
          real: never,
          shell: never,
          sim: () => {
            made += 1;
            return { id: made };
          },
        });
        const a = createCtx({ mode: "sim", seed });
        const b = replica(a);
        expect(access(b)).toBe(access(a));
        expect(made).toBe(1);
      }),
      FC,
    );
  });

  test("`replica` of a real ctx throws E1604", () => {
    const f: unknown = replica;
    expect(typeof f).toBe("function");
    for (const mode of ["real", "shell"] as const) {
      const ctx = createCtx({ mode });
      expect(thrownCode(() => Reflect.apply(Object(f), undefined, [ctx]))).toBe("E1604");
    }
  });
});
