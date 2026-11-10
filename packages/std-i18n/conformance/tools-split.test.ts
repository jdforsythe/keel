// Spec: std.i18n, clause "The package root imports neither `@keel/check` nor `typescript`; `@keel/std-i18n/tools` exports the E2301 rule."
// Seed 1337 (no random inputs)
import { expect, test, vi } from "vitest";

test.skip("The package root imports neither `@keel/check` nor `typescript`; `@keel/std-i18n/tools` exports the E2301 rule.", async () => {
  vi.resetModules();
  vi.doMock("@keel/check", () => {
    throw new Error("root imported @keel/check");
  });
  vi.doMock("typescript", () => {
    throw new Error("root imported typescript");
  });
  await expect(import("@keel/std-i18n")).resolves.toBeDefined();
  vi.doUnmock("@keel/check");
  vi.doUnmock("typescript");
  vi.resetModules();
  const tools: Record<string, unknown> = await import("@keel/std-i18n/tools");
  expect(
    Object.values(tools).some((v) => typeof v === "object" && v !== null && "code" in v && v.code === "E2301"),
  ).toBe(true);
});
