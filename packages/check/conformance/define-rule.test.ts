// Seed 1337
// Spec: k.check, clause "Registering one code twice reports E1753; a rule that throws reports E1756 and other rules' diagnostics still appear."
import { check, defineRule, explain, rules } from "@keel/check";
import fc from "fast-check";
import { expect, test } from "vitest";
import { SEED, findAll, one, registryCodes } from "./support.ts";

defineRule({
  code: "E2901",
  message: "forbiddenName is not allowed",
  see: "k.check",
  explain: "Do not use forbiddenName. Rename it to allowedName.",
  check: ({ file }) => findAll(file, "forbiddenName"),
});

test("defineRule registers a rule that then fires through check at the finding's path, line, and col", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 20 }), fc.integer({ min: 1, max: 30 }), (line, col) => {
      const source = `${"\n".repeat(line - 1)}${" ".repeat(col - 1)}forbiddenName;\n`;
      const d = check(one(source, "a.ts"), {}).diagnostics.filter((x) => x.code === "E2901");
      expect(d.length).toBe(1);
      expect(d[0]?.path).toBe("a.ts");
      expect(d[0]?.line).toBe(line);
      expect(d[0]?.col).toBe(col);
      expect(d[0]?.message).toBe("forbiddenName is not allowed");
    }),
    { seed: SEED, numRuns: 40 },
  );
});

test("a registered rule does not fire on a file without the flagged identifier", () => {
  const d = check(one("const fine = 1;\n", "a.ts"), {}).diagnostics;
  expect(d.map((x) => x.code)).not.toContain("E2901");
});

test("rules() lists a registered rule's code", () => {
  expect(registryCodes(rules())).toContain("E2901");
});

test("explain(code) for a registered rule returns the rule's explain text", () => {
  expect(explain("E2901")).toContain("Rename it to allowedName");
});

test("registering one code twice throws and reports E1753", () => {
  defineRule({ code: "E2902", message: "m", see: "k.check", explain: "e", check: () => [] });
  expect(() => defineRule({ code: "E2902", message: "m", see: "k.check", explain: "e", check: () => [] })).toThrow(
    /E1753/,
  );
});

test("a rule that throws reports E1756 and other rules' diagnostics still appear", () => {
  defineRule({
    code: "E2903",
    message: "always throws",
    see: "k.check",
    explain: "e",
    check: () => {
      throw new Error("boom");
    },
  });
  const codes = check(one("forbiddenName;\n", "a.ts"), {}).diagnostics.map((d) => d.code);
  expect(codes).toContain("E1756");
  expect(codes).toContain("E2901");
});

test("rules are pure and deterministic: repeated check with a registered rule yields identical diagnostics", () => {
  const src = one("forbiddenName;\nforbiddenName;\n", "a.ts");
  expect(check(src, {})).toEqual(check(src, {}));
});
