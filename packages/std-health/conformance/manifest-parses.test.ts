// Spec: std.health, clause "The package's `module.ts` default export parses with `ModuleSchema` and declares the manifest above."
// Seed 1337
import { ModuleSchema } from "@keel/compiler";
import { expect, test } from "vitest";
import manifest from "@keel/std-health/module";

test("The package's `module.ts` default export parses with `ModuleSchema` and declares the manifest above", () => {
  const r = ModuleSchema.parse(manifest);
  expect(r.ok).toBe(true);
  if (!r.ok) return;
  expect(r.value.id).toBe("health");
  expect(r.value.deps).toEqual([]);
  expect(r.value.capabilities).toEqual(["clock"]);
  expect(r.value.public.exports).toEqual(["Health", "routes"]);
  expect(r.value.public.routes).toEqual(["health.status"]);
});
