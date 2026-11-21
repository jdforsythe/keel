// Seed 1337
import { format } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, lines, synth } from "./support.ts";

const codeLines = (out: string, code: string) => lines(out).filter((l) => l.startsWith(`${code} `));

test("compact: groups by code with a cap of 5 and a '... +N more <code>' line", () => {
  fc.assert(
    fc.property(fc.integer({ min: 6, max: 40 }), (n) => {
      const ds = Array.from({ length: n }, (_, i) => synth("E1042", i));
      const out = format(ds, { mode: "compact" });
      expect(codeLines(out, "E1042").length).toBe(5);
      expect(out).toContain(`... +${n - 5} more E1042 (keel check --code E1042)`);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("compact: a code at or under the cap prints every diagnostic and no 'more' line", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
      const ds = Array.from({ length: n }, (_, i) => synth("E1042", i));
      const out = format(ds, { mode: "compact" });
      expect(codeLines(out, "E1042").length).toBe(n);
      expect(out).not.toContain("more E1042");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("compact: the cap applies per code, not overall", () => {
  const ds = [
    ...Array.from({ length: 8 }, (_, i) => synth("E1042", i)),
    ...Array.from({ length: 7 }, (_, i) => synth("E1043", i + 20)),
  ];
  const out = format(ds, { mode: "compact" });
  expect(codeLines(out, "E1042").length).toBe(5);
  expect(codeLines(out, "E1043").length).toBe(5);
  expect(out).toContain("... +3 more E1042");
  expect(out).toContain("... +2 more E1043");
});

test("compact: a diagnostic line is 'code path:line:col message'", () => {
  const out = format([synth("E1042", 4, "src/cart/add.tsx")], { mode: "compact" });
  expect(out).toContain("E1042 src/cart/add.tsx:5:3 synthetic E1042 finding number 4");
});

test("compact: diagnostics within a code are sorted by path, line, col", () => {
  fc.assert(
    fc.property(fc.shuffledSubarray([0, 1, 2, 3, 4], { minLength: 5, maxLength: 5 }), (order) => {
      const ds = order.map((i) => synth("E1042", i, "src/a.tsx"));
      const out = lines(format(ds, { mode: "compact" })).filter((l) => l.startsWith("E1042 "));
      const locs = out.map((l) => Number(l.split(" ")[1]?.split(":")[1]));
      expect(locs).toEqual([1, 2, 3, 4, 5]);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("compact: identical diagnostics are deduplicated", () => {
  const d = synth("E1042", 0);
  const out = format([d, { ...d }, { ...d }], { mode: "compact" });
  expect(codeLines(out, "E1042").length).toBe(1);
});
