// Spec: std.text, clause "After importing `@keel/std-text`, the registry maps `text.Email` and `text.Slug` to the exports; importing it again does not throw."
// Seed 1337 (no random inputs)
import { s } from "@keel/schema";
import { Email, Slug } from "@keel/std-text";
import { expect, test } from "vitest";

test("After importing `@keel/std-text`, the registry maps `text.Email` and `text.Slug` to the exports; importing it again does not throw.", async () => {
  expect(s.registry().get("text.Email")).toBe(Email);
  expect(s.registry().get("text.Slug")).toBe(Slug);
  await expect(import("@keel/std-text")).resolves.toBeDefined();
  expect(s.registry().get("text.Email")).toBe(Email);
  expect(s.registry().get("text.Slug")).toBe(Slug);
});
