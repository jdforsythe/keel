// Spec: std.health, clause "`health.href('health.status')` is `/health`."
// std.health API "It may import `Health`, `routes` and the `./contract` export `health`". Seed 1337
import { health } from "@keel/std-health/contract";
import { expect, test } from "vitest";

test("`health.href('health.status')` is `/health`", () => {
  expect(String(health.href("health.status"))).toBe("/health");
});

test("the `./contract` export is the contract `health` with the one page entry `health.status`", () => {
  expect(health.kind).toBe("keel.contract");
  expect(health.module).toBe("health");
  expect(Object.keys(health.entries)).toEqual(["health.status"]);
});
