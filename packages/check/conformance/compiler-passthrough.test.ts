// Seed 1337
import { check, format } from "@keel/check";
import { compile } from "@keel/compiler";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIXTURES, SEED, lines, one } from "./support.ts";

const COMPILER_CODES = ["E1001", "E1003", "E1401", "E1403", "E1404"];
const compilerFixtures = FIXTURES.filter((f) => COMPILER_CODES.includes(f.code));

test("compiler diagnostics flow through unchanged: same code, path, line, col, message, and fix as compile returns", () => {
  fc.assert(
    fc.property(fc.constantFrom(...compilerFixtures), (fx) => {
      const files = one(fx.bad);
      const fromCompiler = compile(files).diagnostics;
      expect(fromCompiler.length).toBeGreaterThan(0);
      const fromCheck = check(files, {}).diagnostics;
      for (const c of fromCompiler) {
        const match = fromCheck.find((d) => d.code === c.code && d.line === c.line && d.col === c.col);
        expect(match).toBeDefined();
        expect(match?.path).toBe(c.path);
        expect(match?.message).toBe(c.message);
        expect(match?.fix).toBe(c.fix);
      }
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("the json diagnostic keel check emits for a compiler fixture is byte-identical to the one the compiler emits", () => {
  fc.assert(
    fc.property(fc.constantFrom(...compilerFixtures), (fx) => {
      const files = one(fx.bad);
      const compiled = compile(files).diagnostics;
      const emitted = lines(format(check(files, {}).diagnostics, { mode: "json" })).slice(0, -1);
      for (const c of compiled) {
        const wanted = JSON.stringify({ kind: "diag", ...c });
        expect(emitted).toContain(wanted);
      }
    }),
    { seed: SEED, numRuns: 25 },
  );
});
