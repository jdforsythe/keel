// Clause: After `scaffold module`, turbo.json equals the generator's output for the new task graph.
// The generator is a pure function of the task graph, so the same module set yields the same turbo.json regardless of the order modules were added.
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, distinctPair, lowerName, read } from "./fixtures.ts";

// seed 1337
it("after scaffold module, turbo.json equals the generator's output for the new task graph", () => {
  fc.assert(
    fc.property(distinctPair(lowerName), ([a, b]) => {
      const root = apply("project", { name: "shop" }, new Map()).files;
      const ab = apply("module", { id: b }, apply("module", { id: a }, root).files).files;
      const ba = apply("module", { id: a }, apply("module", { id: b }, root).files).files;
      expect(read(ab, "turbo.json")).toBe(read(ba, "turbo.json"));
      expect(read(ab, "turbo.json")).toMatch(/generated/i);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("scaffold module regenerates turbo.json and reports it among the written files", () => {
  const root = apply("project", { name: "shop" }, new Map()).files;
  const out = apply("module", { id: "orders" }, root);
  expect([...out.created, ...out.changed]).toContain("turbo.json");
});
