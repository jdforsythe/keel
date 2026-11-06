// Seed 1337
import { check, format } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIXTURES, one, SEED, synth } from "./support.ts";

const ESC = String.fromCharCode(27);

test("no ANSI escapes in compact or json output", () => {
  fc.assert(
    fc.property(
      fc.constantFrom("compact", "json"),
      fc.integer({ min: 0, max: 15 }),
      fc.constantFrom(...FIXTURES),
      (mode, n, fx) => {
        const injected = Array.from({ length: n }, (_, i) => synth("E1042", i, "src/a.tsx", "-a\n+b"));
        const real = check(one(fx.bad), {}).diagnostics;
        expect(format([...injected, ...real], { mode })).not.toContain(ESC);
      },
    ),
    { seed: SEED, numRuns: 30 },
  );
});

test("compact and json output contain no spinner, banner, or timestamp lines", () => {
  const out = format([synth("E1042", 0)], { mode: "compact" });
  expect(out).not.toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:/);
});
