// Spec: std.messages, clause "The package root imports neither `@keel/check` nor `typescript`; `@keel/std-messages/tools` exports the six rules."
// Seed 1337 (no random inputs)
import { expect, test, vi } from "vitest";

test("The package root imports neither `@keel/check` nor `typescript`; `@keel/std-messages/tools` exports the six rules.", async () => {
  vi.resetModules();
  vi.doMock("@keel/check", () => {
    throw new Error("root imported @keel/check");
  });
  vi.doMock("typescript", () => {
    throw new Error("root imported typescript");
  });
  await expect(import("@keel/std-messages")).resolves.toBeDefined();
  vi.doUnmock("@keel/check");
  vi.doUnmock("typescript");
  vi.resetModules();
  const tools: Record<string, unknown> = await import("@keel/std-messages/tools");
  const codes = Object.values(tools).flatMap((v) =>
    typeof v === "object" && v !== null && "code" in v && typeof v.code === "string" ? [v.code] : [],
  );
  expect(codes.sort()).toEqual(["E2401", "E2402", "E2403", "E2404", "E2405", "E2406"]);
});
