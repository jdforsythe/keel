// Seed 1337
import { check, format } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIXTURES, SEED, lines, one, synth } from "./support.ts";

test("--limit N sets the per-code cap, followed by '... +K more <code> (keel check --code <code>)'", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 12 }), fc.integer({ min: 13, max: 30 }), (limit, n) => {
      const ds = Array.from({ length: n }, (_, i) => synth("E1042", i));
      const out = format(ds, { mode: "compact", limit });
      expect(lines(out).filter((l) => l.startsWith("E1042 ")).length).toBe(limit);
      expect(out).toContain(`... +${n - limit} more E1042 (keel check --code E1042)`);
    }),
    { seed: SEED, numRuns: 30 },
  );
});

test("--quiet prints the trailer only", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 20 }), (n) => {
      const ds = Array.from({ length: n }, (_, i) => synth("E1042", i));
      const out = format(ds, { mode: "compact", quiet: true });
      expect(lines(out).length).toBe(1);
      expect(out).not.toContain("src/f");
      expect(out).not.toContain("E1042 ");
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("--code <code> keeps only that code", () => {
  const ds = [synth("E1501", 0), synth("E1501", 1), synth("E1003", 2), synth("E1403", 3)];
  const out = format(ds, { mode: "compact", code: "E1501" });
  expect(lines(out).filter((l) => l.startsWith("E1501 ")).length).toBe(2);
  expect(out).not.toContain("E1003 ");
  expect(out).not.toContain("E1403 ");
});

test("--code E1501 emits only E1501 diagnostics while the summary counts every code", () => {
  const ds = [synth("E1501", 0), synth("E1003", 1), synth("E1003", 2), synth("E1403", 3)];
  const all = lines(format(ds, { mode: "json" }));
  const only = lines(format(ds, { mode: "json", code: "E1501" }));
  const diagKinds = only.slice(0, -1).map((l) => JSON.parse(l));
  expect(diagKinds.length).toBe(1);
  for (const d of diagKinds) expect(d.code).toBe("E1501");
  expect(only[only.length - 1]).toBe(all[all.length - 1]);
});

test("--code on check output keeps only that code and drops the others", () => {
  const diagnostics = FIXTURES.flatMap((f) => check(one(f.bad, `${f.code}.tsx`), {}).diagnostics);
  const out = format(diagnostics, { mode: "compact", code: "E1003" });
  expect(out).toContain("E1003 ");
  expect(out).not.toContain("E1403 ");
});
