// Spec: k.supervise, clause "With `T` a `KeelError` and a sim ctx: `supervise(ctx, 'm.run', () => 1, T)` is `ok(1)`; `supervise(ctx, 'm.run', () => err(U), T)` deep-equals `err(U)` for a second `KeelError` `U`; each `async` form resolves to the same; and none of them reports an `error` event."
// Spec: k.supervise, clause "With `t` each of `new Error('a')`, the string `'s'`, `undefined`, the object `{ code: 'x' }`, a value `defect('bug', 'E2801')` throws and `new Error('w', { cause: d })` for `d` a defect: `supervise(ctx, 'm.run', () => { throw t }, T)` returns a value deep-equal to `err(T)` and does not throw, and `supervise(ctx, 'm.run', async () => { throw t }, T)` resolves to the same and does not reject."
// Spec: k.supervise, clause "For each of those throws an observer of `ctx` gets exactly one `error` event, its `error` deep-equal to `{ code: 'keel.unexpected', message: 'keel.unexpected', data: { at: 'm.run' } }`; with an observer that throws, `supervise` still returns `err(T)`."
// Seed 1337. `supervise` is exported by `@keel/ctx` once built: until then this file does not typecheck and every case fails for want of it.
import { type CtxEvent, createCtx, observe, supervise } from "@keel/ctx";
import { type KeelError, defect, err, ok, s } from "@keel/schema";
import fc from "fast-check";
import { describe, expect, it } from "vitest";

const SEED = 1337;
const T = s.error("m.t", s.object({})).make({});
const U = s.error("m.u", s.object({})).make({});
const sim = () => createCtx({ mode: "sim", seed: SEED });
const watch = (ctx: ReturnType<typeof sim>): CtxEvent[] => {
  const got: CtxEvent[] = [];
  observe(ctx, (e) => {
    got.push(e);
  });
  return got;
};
const made = (): unknown => {
  try {
    return defect("bug", "E2801");
  } catch (e) {
    return e;
  }
};
const d = made();
const THROWN: readonly (readonly [string, unknown])[] = [
  ["new Error('a')", new Error("a")],
  ["the string 's'", "s"],
  ["undefined", undefined],
  ["the object { code: 'x' }", { code: "x" }],
  ["a defect", d],
  ["an Error whose cause is a defect", new Error("w", { cause: d })],
];
const UNEXPECTED: KeelError<"keel.unexpected", { at: string }> = {
  code: "keel.unexpected",
  message: "keel.unexpected",
  data: { at: "m.run" },
};

describe("k.supervise: what fn returns", () => {
  it("supervise(ctx, 'm.run', () => 1, T) is ok(1), and an async fn resolves to the same", async () => {
    const ctx = sim();
    const events = watch(ctx);
    expect(supervise(ctx, "m.run", () => 1, T)).toEqual(ok(1));
    expect(await supervise(ctx, "m.run", async () => 1, T)).toEqual(ok(1));
    expect(events).toEqual([]);
  });

  it("supervise(ctx, 'm.run', () => err(U), T) deep-equals err(U), and an async fn resolves to the same, with no error event", async () => {
    const ctx = sim();
    const events = watch(ctx);
    expect(supervise(ctx, "m.run", () => err(U), T)).toEqual(err(U));
    expect(await supervise(ctx, "m.run", async () => err(U), T)).toEqual(err(U));
    expect(events).toEqual([]);
  });

  it("property: a returned value v that is no Result gives ok(v) and no error event", () => {
    fc.assert(
      fc.property(
        fc.jsonValue().filter((v) => typeof v !== "object" || v === null || !("ok" in v)),
        (v) => {
          const ctx = sim();
          const events = watch(ctx);
          expect(supervise(ctx, "m.run", () => v, T)).toEqual(ok(v));
          expect(events).toEqual([]);
        },
      ),
      { seed: SEED },
    );
  });
});

describe("k.supervise: every throw gives err(failed) and never throws or rejects", () => {
  for (const [name, t] of THROWN) {
    it(`a sync throw of ${name} returns a value deep-equal to err(T) and does not throw`, () => {
      const ctx = sim();
      expect(
        supervise(
          ctx,
          "m.run",
          () => {
            throw t;
          },
          T,
        ),
      ).toEqual(err(T));
    });
    it(`an async throw of ${name} resolves to err(T) and does not reject`, async () => {
      const ctx = sim();
      await expect(
        supervise(
          ctx,
          "m.run",
          async () => {
            throw t;
          },
          T,
        ),
      ).resolves.toEqual(err(T));
    });
  }

  it("property: whatever fn throws or rejects with, sync or async, the result is err(T)", async () => {
    await fc.assert(
      fc.asyncProperty(fc.anything(), async (t) => {
        const ctx = sim();
        const a = supervise(
          ctx,
          "m.run",
          () => {
            throw t;
          },
          T,
        );
        const b = await supervise(ctx, "m.run", () => Promise.reject(t), T);
        expect(a).toEqual(err(T));
        expect(b).toEqual(err(T));
      }),
      { seed: SEED },
    );
  });
});

describe("k.supervise: one error event per throw", () => {
  for (const [name, t] of THROWN) {
    it(`a sync and an async throw of ${name} give an observer exactly one error event each, keel.unexpected with data.at 'm.run'`, async () => {
      const ctx = sim();
      const events = watch(ctx);
      supervise(
        ctx,
        "m.run",
        () => {
          throw t;
        },
        T,
      );
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual({ kind: "error", error: UNEXPECTED });
      await supervise(ctx, "m.run", () => Promise.reject(t), T);
      expect(events).toHaveLength(2);
      expect(events[1]).toEqual({ kind: "error", error: UNEXPECTED });
    });
  }

  it("with an observer that throws, supervise still returns err(T), sync and async", async () => {
    const ctx = sim();
    observe(ctx, () => {
      throw new Error("observer");
    });
    expect(
      supervise(
        ctx,
        "m.run",
        () => {
          throw new Error("a");
        },
        T,
      ),
    ).toEqual(err(T));
    await expect(supervise(ctx, "m.run", () => Promise.reject(new Error("a")), T)).resolves.toEqual(err(T));
  });

  it("the event holds nothing of the thrown value", () => {
    const ctx = sim();
    const events = watch(ctx);
    supervise(
      ctx,
      "m.run",
      () => {
        throw new Error("jane@x.com");
      },
      T,
    );
    expect(JSON.stringify(events)).not.toContain("jane");
  });
});
