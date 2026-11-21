// Seed 1337
import { check, defineRule } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, findAll, one } from "./support.ts";

defineRule({
  code: "E2911",
  message: "ok rule",
  see: "k.check",
  explain: "e",
  check: ({ file }) => findAll(file, "forbiddenName"),
});
defineRule({
  code: "E2912",
  message: "thrower",
  see: "k.check",
  explain: "e",
  check: () => {
    throw new Error("boom");
  },
});

test("E1756: a rule that threw is reported and the other rules still run", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 5 }), (n) => {
      const source = `${"forbiddenName;\n".repeat(n)}`;
      const d = check(one(source, "a.ts"), {}).diagnostics;
      expect(d.filter((x) => x.code === "E1756").length).toBeGreaterThanOrEqual(1);
      expect(d.filter((x) => x.code === "E2911").length).toBe(n);
    }),
    { seed: SEED, numRuns: 10 },
  );
});

test("E1756: the message names the rule that threw and is under 90 chars", () => {
  const d = check(one("x;\n", "a.ts"), {}).diagnostics.filter((x) => x.code === "E1756");
  expect(d[0]?.message).toContain("E2912");
  expect(d[0]?.message.length).toBeLessThan(90);
});
