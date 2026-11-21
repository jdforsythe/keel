// Spec: k.formats, clause "`s.format(name, base, { check, gen: { from, map } })` ... brands its type `Format<T, name>`." (rfc:0079)
// Type-level only; no random inputs. The schemas are built inside the test so the module loads before `s.format` exists.
import { type Format, type Infer, s } from "@keel/schema";
import { describe, expect, expectTypeOf, test } from "vitest";

const mk = () => ({
  Even: s.format("even", s.int(), { check: (v) => v % 2 === 0, gen: { from: s.int(), map: (n) => n * 2 } }),
  Odd: s.format("odd", s.int(), { check: (v) => v % 2 !== 0, gen: { from: s.int(), map: (n) => n * 2 + 1 } }),
});

describe("k.schema format types: brand", () => {
  test("the inferred type is `Format<number, 'even'>`, not assignable across names or from `number`", () => {
    const { Even, Odd } = mk();
    expectTypeOf<Infer<typeof Even>>().toEqualTypeOf<Format<number, "even">>();
    expectTypeOf<Infer<typeof Even>>().not.toEqualTypeOf<Infer<typeof Odd>>();
    expectTypeOf<number>().not.toMatchTypeOf<Infer<typeof Even>>();
    expectTypeOf<Infer<typeof Even>>().toMatchTypeOf<number>();
    expect(Even.doc()).not.toBe(Odd.doc());
  });
});
