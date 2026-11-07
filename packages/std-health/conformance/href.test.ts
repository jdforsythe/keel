// Spec: std.health, clause "`routes.href('health.status')` is `/health`."
// Seed 1337
import { routes } from "@keel/std-health/routes";
import { expect, test } from "vitest";

test("`routes.href('health.status')` is `/health`", () => {
  expect(String(routes.href("health.status"))).toBe("/health");
});
