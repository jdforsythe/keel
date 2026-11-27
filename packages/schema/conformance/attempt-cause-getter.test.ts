// Spec: k.attempt, clause "With `v` an `Error` whose `cause` is a getter that throws `g`, and `p` a `Proxy` over an `Error` whose `get` trap throws `g`: `attempt(() => { throw v }, spy)` calls `spy` once with `v` itself and, `spy` returning `undefined`, throws `v` itself, never `g`; the same holds of `p`."
// Seed 1337.
import { attempt } from "@keel/schema";
import { describe, expect, it } from "vitest";

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
    // The assertions compare by `Object.is` on booleans and wrap values in a box, so neither the matcher nor promise resolution reads the trapped value.
    it(`for ${name}, attempt calls spy once with the value itself and, spy returning undefined, throws the value itself, never g`, () => {
      const v = make();
      const seen: { value: unknown }[] = [];
      const spy = (x: unknown): undefined => void seen.push({ value: x });
      const thrown = thrownBy(() =>
        attempt(() => {
          throw v;
        }, spy),
      );
      expect(Object.is(thrown, v)).toBe(true);
      expect(Object.is(thrown, g)).toBe(false);
      expect(seen).toHaveLength(1);
      expect(Object.is(seen[0]?.value, v)).toBe(true);
    });

    it(`for ${name}, an async throw rejects with the value itself, never g`, async () => {
      const v = make();
      const seen: { value: unknown }[] = [];
      const spy = (x: unknown): undefined => void seen.push({ value: x });
      const rejected = await attempt(async () => {
        throw v;
      }, spy).then(
        () => ({ value: undefined }),
        (e: unknown) => ({ value: e }),
      );
      expect(Object.is(rejected.value, v)).toBe(true);
      expect(Object.is(rejected.value, g)).toBe(false);
      expect(seen).toHaveLength(1);
    });
  }
});
