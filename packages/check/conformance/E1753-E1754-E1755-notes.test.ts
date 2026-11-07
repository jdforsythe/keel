// Seed 1337
import { check, defineRule } from "@keel/check";
import { expect, test } from "vitest";
import { findAll, one } from "./support.ts";

// E1753 duplicate code: define-rule.test.ts. E1753 stdlib range, E1754, E1755: E1753-E1754-E1755.test.ts (RFC 0035).
// Conformance "A tree with only W diagnostics exits 0": the exit code is the CLI's (k.cli exitCode); here the check
// summary says `ok: true` when the tree has W diagnostics and no E diagnostic.
test("a tree with only W diagnostics reports summary.ok", () => {
  defineRule({
    code: "W2951",
    message: "warned",
    see: "k.check",
    explain: "e",
    check: ({ file }) => findAll(file, "warnName"),
  });
  const r = check(one("export const warnName = 1\n", "warnName.ts"), {});
  expect(r.diagnostics.map((d) => d.code)).toEqual(["W2951"]);
  expect(r.summary.ok).toBe(true);
  expect(r.summary.warnings).toBe(1);
  expect(r.summary.errors).toBe(0);
  expect(check(one("export const a: number = 'x'\n", "a.ts"), {}).summary.ok).toBe(false);
});
