// Spec: std.temporal, clause "After importing `@keel/std-temporal`, the registry maps the four names to the exports; importing it again does not throw."
// Seed 1337 (no random inputs)
import { s } from "@keel/schema";
import { Duration, Instant, PlainDate, TimeZone } from "@keel/std-temporal";
import { expect, test } from "vitest";

test("After importing `@keel/std-temporal`, the registry maps the four names to the exports; importing it again does not throw.", async () => {
  expect(s.registry().get("temporal.Instant")).toBe(Instant);
  expect(s.registry().get("temporal.PlainDate")).toBe(PlainDate);
  expect(s.registry().get("temporal.TimeZone")).toBe(TimeZone);
  expect(s.registry().get("temporal.Duration")).toBe(Duration);
  await expect(import("@keel/std-temporal")).resolves.toBeDefined();
  expect(s.registry().get("temporal.Instant")).toBe(Instant);
  expect(s.registry().get("temporal.Duration")).toBe(Duration);
});
