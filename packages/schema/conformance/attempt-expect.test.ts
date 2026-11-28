// Spec: k.attempt, clause "With `T` a `KeelError` and `expect` the function `(x) => (x === 0 ? T : undefined)`: `attempt(() => 1, expect)` is `ok(1)`, `attempt(() => ok(1), expect)` deep-equals `ok(1)`, `attempt(() => err(T), expect)` deep-equals `err(T)`, each `async` form resolves to the same, and `attempt(() => ({ ok: true, value: 1 }), expect)` is `ok` of that plain object."
// Spec: k.attempt, clause "With `t` the object `{ code: '23505' }`, `Taken` the KeelError `{ code: 'shop.taken', message: 'shop.taken', data: {} }` and `expect` the function `(x) => (x === t ? Taken : undefined)`: `attempt(() => { throw t }, expect)` is `err(Taken)` and `attempt(async () => { throw t }, expect)` resolves to `err(Taken)`."
// Spec: k.attempt, clause "With that `expect`, `u` the value `new Error('other')` and `k` the object `{ code: 'a.b', message: 'm', data: null }`: `attempt(() => { throw u }, expect)` throws `u` itself, `attempt(async () => { throw u }, expect)` rejects with `u` itself, `attempt(() => { throw k }, expect)` throws `k` itself, `attempt(() => defect('x'), spy)` throws that defect and never calls `spy`, and `attempt(() => { throw t }, () => { throw w })` throws `w` itself."
// Spec: k.errors, clause "`attempt(fn, expect)` returns `ok(value)` when `fn` returns a value, and with `expect` returning `undefined` for every value it throws or rejects with what `fn` threw."
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

type T = KeelError<"x.t", Record<string, never>>;
const T: T = { code: "x.t", message: "x.t", data: {} };
const expectZero = (x: unknown): T | undefined => (x === 0 ? T : undefined);

const t = { code: "23505" };
type Taken = KeelError<"shop.taken", Record<string, never>>;
const Taken: Taken = { code: "shop.taken", message: "shop.taken", data: {} };
const expectT = (x: unknown): Taken | undefined => (x === t ? Taken : undefined);

describe("k.attempt: what attempt does with what fn returns", () => {
  it("attempt(() => 1, expect) is ok(1)", () => {
    expect(attempt(() => 1, expectZero)).toEqual(ok(1));
  });

  it("attempt(() => ok(1), expect) deep-equals ok(1), never ok(ok(1))", () => {
    expect(attempt(() => ok(1), expectZero)).toEqual(ok(1));
  });

  it("attempt(() => err(T), expect) deep-equals err(T), never ok(err(T))", () => {
    expect(attempt(() => err(T), expectZero)).toEqual(err(T));
  });

  it("each async form resolves to the same", async () => {
    await expect(attempt(async () => 1, expectZero)).resolves.toEqual(ok(1));
    await expect(attempt(async () => ok(1), expectZero)).resolves.toEqual(ok(1));
    await expect(attempt(async () => err(T), expectZero)).resolves.toEqual(err(T));
  });

  it("attempt(() => ({ ok: true, value: 1 }), expect) is ok of that plain object", () => {
    const plain = { ok: true, value: 1 };
    expect(attempt(() => plain, expectZero)).toEqual(ok(plain));
    expect(attempt(() => plain, expectZero)).toEqual({ ok: true, value: { ok: true, value: 1 } });
  });

  it("property: a returned value is ok(value) and a returned Result is itself, sync and async", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), fc.string(), async (v, c) => {
        const E: KeelError<"x.y", string> = { code: "x.y", message: "x.y", data: c };
        const none = (): undefined => undefined;
        expect(attempt(() => ok(v), none)).toEqual(ok(v));
        expect(attempt(() => err(E), none)).toEqual(err(E));
        await expect(attempt(async () => ok(v), none)).resolves.toEqual(ok(v));
        await expect(attempt(async () => err(E), none)).resolves.toEqual(err(E));
        if (typeof v !== "object" || v === null || !("ok" in v)) {
          expect(attempt(() => v, none)).toEqual(ok(v));
          await expect(attempt(async () => v, none)).resolves.toEqual(ok(v));
        }
      }),
      opts,
    );
  });
});

describe("k.attempt: expect claims a thrown value", () => {
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

  it("property: a thrown value expect claims is the err of the KeelError it returns, sync and async", async () => {
    await fc.assert(
      fc.asyncProperty(fc.jsonValue(), fc.string(), async (v, c) => {
        const E: KeelError<"x.y", string> = { code: "x.y", message: "x.y", data: c };
        const rec = (x: unknown): KeelError<"x.y", string> | undefined => (Object.is(x, v) ? E : undefined);
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

describe("k.attempt: what expect does not claim goes on as itself", () => {
  const u = new Error("other");
  const k = { code: "a.b", message: "m", data: null };

  it("attempt(() => { throw u }, expect) throws u itself", () => {
    expect(
      thrown(() =>
        attempt(() => {
          throw u;
        }, expectT),
      ),
    ).toBe(u);
  });

  it("attempt(async () => { throw u }, expect) rejects with u itself", async () => {
    await expect(
      rejected(
        attempt(async () => {
          throw u;
        }, expectT),
      ),
    ).resolves.toBe(u);
  });

  it("attempt(() => { throw k }, expect) throws k itself: a KeelError-shaped object is no KeelError to attempt", () => {
    expect(
      thrown(() =>
        attempt(() => {
          throw k;
        }, expectT),
      ),
    ).toBe(k);
  });

  it("a KeelError-shaped throw goes to expect like any other value", () => {
    const seen: unknown[] = [];
    attempt(
      () => {
        throw k;
      },
      (x) => {
        seen.push(x);
        return Taken;
      },
    );
    expect(seen).toEqual([k]);
  });

  it("property: an unclaimed thrown value of any kind goes on as the very value, sync and async", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const none = (): undefined => undefined;
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
    const spy = (): undefined => {
      calls++;
      return undefined;
    };
    const v = thrown(() => attempt(() => defect("x"), spy));
    expect(isDefect(v)).toBe(true);
    expect(v instanceof Error && v.message).toBe("x");
    expect(calls).toBe(0);
  });

  it("property: a defect of any message and code skips expect, sync and async, and is thrown on unchanged", async () => {
    await fc.assert(
      fc.asyncProperty(fc.string(), fc.boolean(), async (m, coded) => {
        let calls = 0;
        const spy = (): undefined => {
          calls++;
          return undefined;
        };
        const mk = () => (coded ? defect(m, { code: "E2801" }) : defect(m));
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
    expect(
      thrown(() =>
        attempt(
          () => {
            throw t;
          },
          () => {
            throw w;
          },
        ),
      ),
    ).toBe(w);
  });
});

describe("k.errors: attempt(fn, expect)", () => {
  it("returns ok(value) when fn returns a value", () => {
    fc.assert(
      fc.property(fc.jsonValue(), (v) => {
        const r = attempt(
          () => v,
          () => undefined,
        );
        if (typeof v === "object" && v !== null && "ok" in v) return;
        expect(r).toEqual(ok(v));
      }),
      opts,
    );
  });

  it("with expect returning undefined for every value, throws or rejects with what fn threw", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (x) => {
        const none = (): undefined => undefined;
        expect(
          Object.is(
            thrown(() =>
              attempt(() => {
                throw x;
              }, none),
            ),
            x,
          ),
        ).toBe(true);
        expect(
          Object.is(
            await rejected(
              attempt(async () => {
                throw x;
              }, none),
            ),
            x,
          ),
        ).toBe(true);
      }),
      opts,
    );
  });
});
