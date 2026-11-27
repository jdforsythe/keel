// Spec: k.attempt, clause "With `v` an `Error` whose `cause` is a getter that throws `g`, and `p` a `Proxy` over an `Error` whose `get` trap throws `g`: `attempt(() => { throw v }, spy)` calls `spy` once with `v` itself and, `spy` returning `undefined`, throws `v` itself, never `g`; the same holds of `p`."
// Seed 1337.
import { attempt } from "@keel/schema";
import { describe, expect, it, vi } from "vitest";

const g = new Error("getter");
const thrownBy = (fn: () => unknown): unknown => {
  try {
    fn();
  } catch (e) {
    return e;
  }
  return undefined;
};
const withGetter = (): Error => {
  const v = new Error("w");
  Object.defineProperty(v, "cause", {
    get() {
      throw g;
    },
  });
  return v;
};
const proxied = (): Error =>
  new Proxy(new Error("p"), {
    get() {
      throw g;
    },
  });

describe("k.attempt: a throwing cause getter does not replace the original throw", () => {
  for (const [name, make] of [
    ["an Error whose cause is a getter that throws", withGetter],
    ["a Proxy over an Error whose get trap throws", proxied],
  ] as const) {
    it(`for ${name}, attempt calls spy once with the value itself and, spy returning undefined, throws the value itself, never g`, () => {
      const v = make();
      const spy = vi.fn((_x: unknown) => undefined);
      const thrown = thrownBy(() =>
        attempt(() => {
          throw v;
        }, spy),
      );
      expect(thrown).toBe(v);
      expect(thrown).not.toBe(g);
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0]?.[0]).toBe(v);
    });

    it(`for ${name}, an async throw rejects with the value itself, never g`, async () => {
      const v = make();
      const spy = vi.fn((_x: unknown) => undefined);
      const rejected = await attempt(async () => {
        throw v;
      }, spy).then(
        () => undefined,
        (e: unknown) => e,
      );
      expect(rejected).toBe(v);
      expect(spy).toHaveBeenCalledTimes(1);
    });
  }
});
