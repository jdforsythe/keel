// Seed 1337. Properties of the value codec both engines share (std.postgres Values): parameters as text, array
// literals, and decoding by type oid.
import type { JsonValue } from "@keel/schema";
import fc from "fast-check";
import { expect, test } from "vitest";
import type { ArrayItem } from "../src/server/internal/ArrayItem.ts";
import { TypeCache } from "../src/server/internal/TypeCache.ts";
import { decodeValue } from "../src/server/internal/decodeValue.ts";
import { parseArray } from "../src/server/internal/parseArray.ts";
import { toText } from "../src/server/internal/toText.ts";

const SEED = 1337;
const TEXT_ARRAY = 1009;
const INT8_ARRAY = 1016;
const types = new TypeCache();
types.arrays.set(TEXT_ARRAY, { elem: 25, delim: "," });
types.arrays.set(INT8_ARRAY, { elem: 20, delim: "," });
types.arrays.set(1020, { elem: 603, delim: ";" });

/** Nested arrays of one depth, as Postgres holds them: strings and nulls. */
const items = (depth: number): fc.Arbitrary<ArrayItem[]> =>
  depth === 0
    ? fc.array(fc.option(fc.string(), { nil: null }), { maxLength: 5 })
    : fc.integer({ min: 1, max: 3 }).chain((n) => fc.array(items(depth - 1), { minLength: n, maxLength: n }));

test("an array parameter's literal parses back to the same elements", () => {
  fc.assert(
    fc.property(
      fc.integer({ min: 0, max: 2 }).chain((d) => items(d)),
      (xs) => {
        const text = toText(xs);
        expect(text).not.toBeNull();
        expect(parseArray(text ?? "")).toEqual(xs);
      },
    ),
    { seed: SEED, numRuns: 300 },
  );
});

test("a text[] value decodes to its strings; NULL to null and a quoted NULL to the string", () => {
  expect(decodeValue('{a,"b c",NULL,"NULL","x\\"y"}', TEXT_ARRAY, types)).toEqual(["a", "b c", null, "NULL", 'x"y']);
  expect(decodeValue("[0:1]={p,q}", TEXT_ARRAY, types)).toEqual(["p", "q"]);
  expect(decodeValue("{(1,1),(0,0);(2,2),(1,1)}", 1020, types)).toEqual(["(1,1),(0,0)", "(2,2),(1,1)"]);
  expect(() => parseArray("{a,b")).toThrow();
  expect(() => parseArray("a,b}")).toThrow();
});

test("int8 is a number within 2^53 - 1 and its text past it, in arrays too", () => {
  fc.assert(
    fc.property(fc.bigInt({ min: -(2n ** 63n), max: 2n ** 63n - 1n }), (n) => {
      const safe = n >= -BigInt(Number.MAX_SAFE_INTEGER) && n <= BigInt(Number.MAX_SAFE_INTEGER);
      const want: JsonValue = safe ? Number(n) : String(n);
      expect(decodeValue(String(n), 20, types)).toBe(want);
      expect(decodeValue(`{${n},NULL}`, INT8_ARRAY, types)).toEqual([want, null]);
    }),
    { seed: SEED, numRuns: 300 },
  );
});

test("bool, int2, int4, float, json and every other type decode as the API says", () => {
  expect(decodeValue("t", 16, types)).toBe(true);
  expect(decodeValue("f", 16, types)).toBe(false);
  expect(decodeValue("-7", 21, types)).toBe(-7);
  expect(decodeValue("70000", 23, types)).toBe(70000);
  expect(decodeValue("2.25", 701, types)).toBe(2.25);
  expect(decodeValue("NaN", 701, types)).toBe("NaN");
  expect(decodeValue("Infinity", 700, types)).toBe("Infinity");
  expect(decodeValue('{"k": [1, 2]}', 3802, types)).toEqual({ k: [1, 2] });
  expect(decodeValue("2026-11-21", 1082, types)).toBe("2026-11-21");
  expect(decodeValue("1.50", 1700, types)).toBe("1.50");
  expect(decodeValue(null, 23, types)).toBeNull();
});

test("a scalar parameter is its text; an object its JSON; null is SQL NULL", () => {
  fc.assert(
    fc.property(fc.oneof(fc.string(), fc.double({ noNaN: true, noDefaultInfinity: true }), fc.boolean()), (v) => {
      expect(toText(v)).toBe(String(v));
    }),
    { seed: SEED, numRuns: 200 },
  );
  expect(toText(null)).toBeNull();
  expect(toText({ a: [1, "x"] })).toBe('{"a":[1,"x"]}');
  expect(toText([{ a: 1 }, null, [true]])).toBe('{"{\\"a\\":1}",NULL,{"true"}}');
});
