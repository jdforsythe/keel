// Spec: k.formats, Conformance "For each of `Instant`, `PlainDate`, `TimeZone` and `Duration` (std.temporal), `Email` and `Slug` (std.text) and every value `v` its `gen` produces, `formatLiteral(F, v)` returns `v`; `formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` returns `'1970-01-01T00:00:00.000Z'`."
// Spec: k.formats, Conformance "`formatLiteral(PlainDate, '2023-02-29')` throws a `TypeError` whose message contains `temporal.PlainDate` and `format`; `formatLiteral(PlainDate, '2024-02-29')` returns `'2024-02-29'`."
// Spec: k.formats, Conformance "A file `const a: Instant = formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` has no type error, as does `const d: PlainDate = formatLiteral(PlainDate, '2024-02-29')`; `formatLiteral(Instant, t)` with `t: string`, `const p: PlainDate = formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` and `formatLiteral(s.string(), 'x')` are each a type error."
// Seed 1337. The three negative type cases are in packages/schema/unsafe/conformanceNegativeTypes.ts (checked by tsc, never
// run); their run-time half is the property below, which calls `formatLiteral` with text the type system would refuse.
import { type Schema, formatLiteral, s } from "@keel/schema";
import { gen } from "@keel/schema/gen";
import { Duration, Instant, PlainDate, TimeZone } from "@keel/std-temporal";
import { Email, Slug } from "@keel/std-text";
import fc from "fast-check";
import { describe, expect, expectTypeOf, test } from "vitest";

const SEED = 1337;
const opts = { seed: SEED, numRuns: 100 };

/** `formatLiteral` called with a `text` of type `string`: what a caller that bypasses the type error would do. */
const call = (format: unknown, text: string): unknown => Reflect.apply(formatLiteral, undefined, [format, text]);
const thrown = (f: () => unknown): unknown => {
  try {
    f();
  } catch (e) {
    return e;
  }
  return undefined;
};

const FORMATS: ReadonlyArray<readonly [string, Schema<string>]> = [
  ["Instant", Instant],
  ["PlainDate", PlainDate],
  ["TimeZone", TimeZone],
  ["Duration", Duration],
  ["Email", Email],
  ["Slug", Slug],
];

describe("k.formats Literals: formatLiteral returns the format's value for a literal that parses", () => {
  test("`formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` returns `'1970-01-01T00:00:00.000Z'`", () => {
    expect(formatLiteral(Instant, "1970-01-01T00:00:00.000Z")).toBe("1970-01-01T00:00:00.000Z");
  });

  for (const [name, F] of FORMATS) {
    test(`for ${name} and every value \`v\` its \`gen\` produces, \`formatLiteral(F, v)\` returns \`v\``, () => {
      fc.assert(
        fc.property(gen(F), (v) => {
          expect(call(F, v)).toBe(v);
        }),
        opts,
      );
    });
  }

  test("for every one of the six formats and any text, `formatLiteral` returns exactly the value `parse` answers `ok` with, and throws exactly when `parse` answers `err`", () => {
    const text = fc.oneof(
      fc.string(),
      fc.constantFrom(...FORMATS).chain(([, F]) => gen(F)),
      fc
        .constantFrom(...FORMATS)
        .chain(([, F]) =>
          fc
            .tuple(gen(F), fc.nat(3), fc.string({ maxLength: 2 }))
            .map(([v, at, junk]) => v.slice(0, at) + junk + v.slice(at + 1)),
        ),
    );
    fc.assert(
      fc.property(fc.constantFrom(...FORMATS), text, ([, F], t) => {
        const r = F.parse(t);
        if (r.ok) {
          expect(call(F, t)).toBe(r.value);
        } else {
          expect(thrown(() => call(F, t))).toBeInstanceOf(TypeError);
        }
      }),
      opts,
    );
  });
});

describe("k.formats Literals: outside `keel check` a text that fails throws a `TypeError` naming the format and the rule", () => {
  test("`formatLiteral(PlainDate, '2024-02-29')` returns `'2024-02-29'`", () => {
    expect(formatLiteral(PlainDate, "2024-02-29")).toBe("2024-02-29");
  });

  test("`formatLiteral(PlainDate, '2023-02-29')` throws a `TypeError` whose message contains `temporal.PlainDate` and `format`", () => {
    const e = thrown(() => formatLiteral(PlainDate, "2023-02-29"));
    expect(e).toBeInstanceOf(TypeError);
    if (!(e instanceof TypeError)) return;
    expect(e.message).toContain("temporal.PlainDate");
    expect(e.message).toContain("format");
  });

  test("the message of the throw names the format's name `N` and the first issue's rule, for every format and any failing text", () => {
    fc.assert(
      fc.property(fc.constantFrom(...FORMATS), fc.string(), ([, F], t) => {
        const r = F.parse(t);
        fc.pre(!r.ok);
        if (r.ok) return;
        const rule = r.error.data.issues[0]?.rule;
        const e = thrown(() => call(F, t));
        expect(e).toBeInstanceOf(TypeError);
        if (!(e instanceof TypeError)) return;
        expect(e.message).toContain(F.doc());
        expect(typeof rule).toBe("string");
        if (typeof rule === "string") expect(e.message).toContain(rule);
      }),
      opts,
    );
  });

  test("a throwing call has no side effect: the same text throws again the same way, and a passing text still returns", () => {
    fc.assert(
      fc.property(gen(PlainDate), (v) => {
        const a = thrown(() => call(PlainDate, `${v}x`));
        const b = thrown(() => call(PlainDate, `${v}x`));
        expect(a).toBeInstanceOf(TypeError);
        expect(b).toBeInstanceOf(TypeError);
        if (a instanceof TypeError && b instanceof TypeError) expect(b.message).toBe(a.message);
        expect(call(PlainDate, v)).toBe(v);
      }),
      opts,
    );
  });
});

describe("k.formats Literals: the types", () => {
  test("`const a: Instant = formatLiteral(Instant, '1970-01-01T00:00:00.000Z')` has no type error, as does `const d: PlainDate = formatLiteral(PlainDate, '2024-02-29')`", () => {
    const a: Instant = formatLiteral(Instant, "1970-01-01T00:00:00.000Z");
    const d: PlainDate = formatLiteral(PlainDate, "2024-02-29");
    expectTypeOf(formatLiteral(Instant, "1970-01-01T00:00:00.000Z")).toEqualTypeOf<Instant>();
    expectTypeOf(formatLiteral(PlainDate, "2024-02-29")).toEqualTypeOf<PlainDate>();
    expectTypeOf<Instant>().not.toEqualTypeOf<PlainDate>();
    expect([a, d]).toEqual(["1970-01-01T00:00:00.000Z", "2024-02-29"]);
  });

  // The three negative cases (a `string`-typed `text`, a brand of another format, `s.string()`) are type errors only: tsc checks
  // them in unsafe/conformanceNegativeTypes.ts and the spec gives no run-time behaviour for them, so none is asserted here.
});
