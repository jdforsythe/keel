// k.supervise API: a returned value whose inspection throws is a throw of `fn`; a `failed` that is no `KeelError` is
// refused before `fn` runs.
import { type CtxEvent, createCtx, observe, supervise } from "@keel/ctx";
import { err, isDefect, s } from "@keel/schema";
import { describe, expect, it } from "vitest";

const T = s.error("m.t", s.object({})).make({});
const sim = () => createCtx({ mode: "sim", seed: 1337 });
const events = (ctx: ReturnType<typeof sim>): CtxEvent[] => {
  const got: CtxEvent[] = [];
  observe(ctx, (e) => {
    got.push(e);
  });
  return got;
};
const trapped = (): unknown =>
  new Proxy(
    {},
    {
      getOwnPropertyDescriptor: () => {
        throw new Error("trap");
      },
      get: () => {
        throw new Error("trap");
      },
      has: () => {
        throw new Error("trap");
      },
    },
  );
const thrownBy = (f: () => unknown): unknown => {
  try {
    f();
  } catch (e) {
    return e;
  }
  return undefined;
};

describe("k.supervise: a returned value whose inspection throws", () => {
  it("is reported once and gives err(T), sync and async", async () => {
    const ctx = sim();
    const got = events(ctx);
    expect(supervise(ctx, "m.run", trapped, T)).toEqual(err(T));
    expect(await supervise(ctx, "m.run", async () => trapped(), T)).toEqual(err(T));
    expect(got.filter((e) => e.kind === "error")).toHaveLength(2);
  });
});

describe("k.supervise: failed that is no KeelError", () => {
  const bad: readonly (readonly [string, unknown])[] = [
    ["new Error('x')", new Error("x")],
    ["the string 'x'", "x"],
    ["{ code: 'a.b' }", { code: "a.b" }],
    ["a Proxy whose traps throw", trapped()],
  ];
  for (const [name, failed] of bad) {
    it(`${name} is the defect E1458 before fn runs`, () => {
      const ctx = sim();
      const got = events(ctx);
      let ran = false;
      const thrown = thrownBy(() =>
        Reflect.apply(supervise, undefined, [
          ctx,
          "m.run",
          () => {
            ran = true;
          },
          failed,
        ]),
      );
      expect(isDefect(thrown, "E1458")).toBe(true);
      expect(ran).toBe(false);
      expect(got).toEqual([]);
    });
  }
});
