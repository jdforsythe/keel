// Spec: std.temporal, clause "For generated `d` and `n` whose results are in range, `addDays` of `addDays(d, n)`'s value and `-n` is `d`; `addDays('2024-02-28', 1)` is `2024-02-29`; `addDays('9999-12-31', 1)` is `err` with `value` 1."
// Seed 1337
import { gen } from "@keel/schema/gen";
import { PlainDate, addDays } from "@keel/std-temporal";
import fc from "fast-check";
import { expect, test } from "vitest";

function must<T>(r: { ok: true; value: T } | { ok: false }): T {
  if (!r.ok) throw new Error("expected ok");
  return r.value;
}

test.skip("For generated `d` and `n` whose results are in range, `addDays` of `addDays(d, n)`'s value and `-n` is `d`; `addDays('2024-02-28', 1)` is `2024-02-29`; `addDays('9999-12-31', 1)` is `err` with `value` 1.", () => {
  fc.assert(
    fc.property(gen(PlainDate), fc.integer({ min: -4_000_000, max: 4_000_000 }), (d, n) => {
      const there = addDays(d, n);
      fc.pre(there.ok);
      if (!there.ok) return;
      const back = addDays(there.value, -n);
      expect(back.ok).toBe(true);
      if (back.ok) expect(back.value).toBe(d);
    }),
    { seed: 1337, numRuns: 300 },
  );
  expect(must(addDays(must(PlainDate.parse("2024-02-28")), 1))).toBe("2024-02-29");
  const over = addDays(must(PlainDate.parse("9999-12-31")), 1);
  expect(over.ok).toBe(false);
  if (!over.ok) {
    expect(over.error.code).toBe("temporal.outOfRange");
    expect(over.error.data.value).toBe(1);
  }
});
