import { defect, isDefect } from "@keel/schema";
// Seed 1337. E2457's words for each kind of value that is not JSON, at any depth and position, and the error's code
// property (std.postgres API, Errors).
import fc from "fast-check";
import { expect, test } from "vitest";
import { toParam } from "../src/internal/toParam.ts";

const SEED = 1337;

const THROWERS: Readonly<Record<string, (text: string) => never>> = {
  E2453: (text) => defect(text, { code: "E2453" }),
  E2454: (text) => defect(text, { code: "E2454" }),
  E2455: (text) => defect(text, { code: "E2455" }),
  E2457: (text) => defect(text, { code: "E2457" }),
};

/** The defect `THROWERS[code]` throws with `text`. */
function thrownBy(code: string, text: string): Error {
  try {
    THROWERS[code]?.(text);
  } catch (e) {
    if (e instanceof Error) return e;
  }
  throw new Error("no defect thrown");
}

class Named {}
const anonymous = new (class {})();
const noConstructor = Object.create(Object.create(null));
const constructorNotNamed = Object.create({ constructor: { name: 5 } });

/** A value that is not JSON and the words E2457 names it by. */
const KINDS: [unknown, string][] = [
  [undefined, "undefined"],
  [Number.NaN, "a non-finite number"],
  [Number.POSITIVE_INFINITY, "a non-finite number"],
  [-Number.POSITIVE_INFINITY, "a non-finite number"],
  [10n, "a bigint"],
  [Symbol("s"), "a symbol"],
  [() => 1, "a function"],
  [Object.create(Date.prototype), "a Date"],
  [new Map(), "a Map"],
  [new Uint8Array(1), "a Uint8Array"],
  [new Named(), "a Named"],
  [anonymous, "an object that is not plain"],
  [noConstructor, "an object that is not plain"],
  [constructorNotNamed, "an object that is not plain"],
];

/** Puts `v` at `depth` levels inside arrays and plain objects. */
const nest = (v: unknown, path: boolean[]): unknown =>
  path.reduce<unknown>((x, inArray) => (inArray ? [1, x] : { k: x }), v);

test("E2457's data names the position and the value's kind in words, never the value, at any depth", () => {
  fc.assert(
    fc.property(
      fc.constantFrom(...KINDS.keys()),
      fc.integer({ min: 1, max: 99 }),
      fc.array(fc.boolean(), { maxLength: 4 }),
      (k, position, path) => {
        const [value, words] = KINDS[k] ?? [undefined, "undefined"];
        let thrown: unknown;
        try {
          toParam(nest(value, path), position);
        } catch (e) {
          thrown = e;
        }
        expect(isDefect(thrown, "E2457")).toBe(true);
        expect(thrown instanceof Error && thrown.message).toBe("E2457 std.postgres: a parameter is not a JSON value");
        expect(Reflect.get(Object(thrown), "data")).toEqual({ position, kind: words });
      },
    ),
    { seed: SEED, numRuns: 200 },
  );
});

test("a value that is JSON comes back equal, as a copy", () => {
  fc.assert(
    fc.property(fc.jsonValue(), (v) => {
      const copy = toParam(v, 1);
      expect(copy).toEqual(v);
      if (typeof v === "object" && v !== null) expect(copy).not.toBe(v);
    }),
    { seed: SEED, numRuns: 100 },
  );
});

test("a coded defect's message starts with its code; the code property is there and not enumerable", () => {
  fc.assert(
    fc.property(fc.constantFrom("E2453", "E2454", "E2455", "E2457"), fc.string(), (code, text) => {
      const e = thrownBy(code, text);
      expect(e.message).toBe(`${code} ${text}`);
      expect(Reflect.get(e, "code")).toBe(code);
      expect(Object.keys(e)).toEqual([]);
      expect(Object.getOwnPropertyDescriptor(e, "code")?.enumerable).toBe(false);
      expect(Object.getOwnPropertyDescriptor(e, "")).toBeUndefined();
    }),
    { seed: SEED, numRuns: 50 },
  );
});
