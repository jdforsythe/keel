// @vitest-environment happy-dom
// fast-check seed: 1337
import fc from "fast-check";
import { expect, expectTypeOf, test } from "vitest";
import { FIELDS, RUNS, SEED, setup } from "./fixtures.ts";

test("E1902 field(path) path not in the schema throws", () => {
  const h = setup();
  const loose: (path: string) => unknown = h.f.field;
  try {
    expectTypeOf<Parameters<typeof h.f.field>[0]>().not.toEqualTypeOf<string>();
    expect(() => h.f.field("title")).not.toThrow();
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,8}(\.[a-z]{1,8})?$/).filter((p) => !FIELDS.some((n) => n === p)),
        (path) => {
          expect(() => loose(path)).toThrow(/^E1902 /);
        },
      ),
      { seed: SEED, numRuns: RUNS },
    );
  } finally {
    h.dispose();
  }
});
