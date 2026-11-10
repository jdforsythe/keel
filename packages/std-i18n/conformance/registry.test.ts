// Spec: std.i18n, clause "After importing `@keel/std-i18n`, `s.registry().get('i18n.Locale')` is `Locale`; importing it again does not throw."
// Seed 1337 (no random inputs)
import { s } from "@keel/schema";
import { Locale } from "@keel/std-i18n";
import { expect, test } from "vitest";

test("After importing `@keel/std-i18n`, `s.registry().get('i18n.Locale')` is `Locale`; importing it again does not throw.", async () => {
  expect(s.registry().get("i18n.Locale")).toBe(Locale);
  await expect(import("@keel/std-i18n")).resolves.toBeDefined();
  expect(s.registry().get("i18n.Locale")).toBe(Locale);
});
