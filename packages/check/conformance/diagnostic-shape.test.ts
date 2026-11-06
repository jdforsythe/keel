// Seed 1337
import { check, rules } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { FIXTURES, one, registryEntry, SEED } from "./support.ts";

test("every diagnostic has a stable code matching ^[EWI]\\d{4}$, path:line:col, a message under 90 chars, and fix when the rule declares one", () => {
  fc.assert(
    fc.property(fc.constantFrom(...FIXTURES), (fx) => {
      const { diagnostics } = check(one(fx.bad), {});
      expect(diagnostics.length).toBeGreaterThan(0);
      for (const d of diagnostics) {
        expect(d.code).toMatch(/^[EWI]\d{4}$/);
        expect(d.path).toBe("C.tsx");
        expect(Number.isInteger(d.line) && d.line >= 1).toBe(true);
        expect(Number.isInteger(d.col) && d.col >= 1).toBe(true);
        expect(d.message.length).toBeLessThan(90);
        expect(d.message).not.toContain("\n");
        const rule = registryEntry(rules(), d.code);
        if (typeof rule === "object" && rule !== null && "fix" in rule && typeof rule.fix === "function") {
          expect(typeof d.fix).toBe("string");
        }
      }
    }),
    { seed: SEED, numRuns: 25 },
  );
});

test("E1401 fixture carries a fix as a unified diff hunk", () => {
  const fx = FIXTURES.find((f) => f.code === "E1401");
  const d = check(one(fx?.bad ?? ""), {}).diagnostics.filter((x) => x.code === "E1401");
  expect(d.length).toBeGreaterThan(0);
  expect(d[0]?.fix).toMatch(/^[-+@ ]|^---/m);
});
