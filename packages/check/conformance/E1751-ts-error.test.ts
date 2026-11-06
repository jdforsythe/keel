// Seed 1337
import { check } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { one, SEED } from "./support.ts";

test("E1751: a TS type error with no Keel rule code is reported with a message that starts with the TS code", () => {
  fc.assert(
    fc.property(fc.stringMatching(/^[a-z]{3,8}$/), (name) => {
      const d = check(one(`export const ${name}: number = "text";\n`, `${name}.ts`), {}).diagnostics.filter(
        (x) => x.code === "E1751",
      );
      expect(d.length).toBe(1);
      expect(d[0]?.message).toMatch(/^TS\d{4}/);
      expect(d[0]?.line).toBe(1);
    }),
    { seed: SEED, numRuns: 20 },
  );
});

test("E1751: a well-typed file reports no E1751", () => {
  const d = check(one(`export const a: number = 1;\n`, "a.ts"), {}).diagnostics;
  expect(d.map((x) => x.code)).not.toContain("E1751");
});
