// Spec: k.errors, clause "With `t` the object `{ code: '23505' }`, `Taken` the KeelError `{ code: 'shop.taken', message: 'shop.taken', data: {} }` and `expect` the function `(x) => (x === t ? Taken : undefined)`: `attempt(() => { throw t }, expect)` is `err(Taken)`, `attempt(async () => { throw t }, expect)` resolves to `err(Taken)`, `attempt(() => 1, expect)` is `ok(1)` and `attempt(async () => 1, expect)` resolves to `ok(1)`."
// Spec: k.errors, clause "With that `expect` and `u` the value `new Error('other')`: `attempt(() => { throw u }, expect)` throws `u` itself and `attempt(async () => { throw u }, expect)` rejects with `u` itself; `attempt(() => defect('x'), spy)` throws that defect and never calls `spy`; `attempt(() => { throw t }, () => { throw w })` throws `w` itself."
// Seed 1337.
import { attempt, defect, err, isDefect, ok } from "@keel/schema";
import type { KeelError } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { RUNS, SEED } from "./fixtures";

const opts = { seed: SEED, numRuns: RUNS };
const thrown = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};
const rejected = (p: Promise<unknown>): Promise<unknown> =>
  p.then(
    () => undefined,
    (e: unknown) => e,
  );

const t = { code: "23505" };
const Taken: KeelError<"shop.taken", Record<string, never>> = { code: "shop.taken", message: "shop.taken", data: {} };
const expectT = (x: unknown): KeelError<"shop.taken", Record<string, never>> | undefined =>
  x === t ? Taken : undefined;

describe("k.errors: attempt(fn, expect) returns what expect recognizes", () => {
  it("attempt(() => { throw t }, expect) is err(Taken)", () => {
    expect(
      attempt(() => {
        throw t;
      }, expectT),
    ).toEqual(err(Taken));
  });

  it("attempt(async () => { throw t }, expect) resolves to err(Taken)", async () => {
    await expect(
      attempt(async () => {
        throw t;
      }, expectT),
    ).resolves.toEqual(err(Taken));
  });

  it("attempt(() => 1, expect) is ok(1)", () => {
    expect(attempt(() => 1, expectT)).toEqual(ok(1));
  });

  it("attempt(async () => 1, expect) resolves to ok(1)", async () => {
    await expect(attempt(async () => 1, expectT)).resolves.toEqual(ok(1));
  });

  it("for every returned value attempt(fn, expect) is ok(value), and for every recognized throw err(that KeelError), sync and async", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), fc.string(), async (v, c) => {
        const E: KeelError<"x.y", string> = { code: "x.y", message: "x.y", data: c };
        const rec = (x: unknown): KeelError<"x.y", string> | undefined => (x === v ? E : undefined);
        expect(attempt(() => v, rec)).toEqual(ok(v));
        await expect(attempt(async () => v, rec)).resolves.toEqual(ok(v));
        expect(
          attempt(() => {
            throw v;
          }, rec),
        ).toEqual(err(E));
        await expect(
          attempt(async () => {
            throw v;
          }, rec),
        ).resolves.toEqual(err(E));
      }),
      opts,
    );
  });
});

describe("k.errors: attempt(fn, expect) hands on what expect does not expect", () => {
  const u = new Error("other");

  it("attempt(() => { throw u }, expect) throws u itself", () => {
    const v = thrown(() =>
      attempt(() => {
        throw u;
      }, expectT),
    );
    expect(v).toBe(u);
  });

  it("attempt(async () => { throw u }, expect) rejects with u itself", async () => {
    const v = await rejected(
      attempt(async () => {
        throw u;
      }, expectT),
    );
    expect(v).toBe(u);
  });

  it("an unrecognized thrown value of any kind goes on as the very value, sync and async", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const none = (): KeelError<"x.y", null> | undefined => undefined;
        const s = thrown(() =>
          attempt(() => {
            throw x;
          }, none),
        );
        expect(Object.is(s, x)).toBe(true);
        const a = await rejected(
          attempt(async () => {
            throw x;
          }, none),
        );
        expect(Object.is(a, x)).toBe(true);
      }),
      opts,
    );
  });

  it("attempt(() => defect('x'), spy) throws that defect and never calls spy", () => {
    let calls = 0;
    const spy = (_: unknown): KeelError<"x.y", null> | undefined => {
      calls++;
      return undefined;
    };
    const v = thrown(() => attempt(() => defect("x"), spy));
    expect(isDefect(v)).toBe(true);
    expect(v instanceof Error && v.message).toBe("x");
    expect(calls).toBe(0);
  });

  it("a defect of any message and code skips expect, sync and async, and is thrown on unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.boolean(), async (m, coded) => {
        let calls = 0;
        const spy = (_: unknown): KeelError<"x.y", null> | undefined => {
          calls++;
          return undefined;
        };
        const mk = () => (coded ? defect(m, "E2801") : defect(m));
        const s = thrown(() => attempt(mk, spy));
        expect(isDefect(s)).toBe(true);
        const a = await rejected(attempt(async () => mk(), spy));
        expect(isDefect(a)).toBe(true);
        expect(calls).toBe(0);
      }),
      opts,
    );
  });

  it("attempt(() => { throw t }, () => { throw w }) throws w itself", () => {
    const w = new Error("w");
    const v = thrown(() =>
      attempt(
        () => {
          throw t;
        },
        () => {
          throw w;
        },
      ),
    );
    expect(v).toBe(w);
  });
});
