// Spec: k.scaffold, Turbo emission "Any operation adding or removing a module or package regenerates `turbo.json`, CI workflows and deploy files (k.deploy) from the task graph and topology (ADR-0009)."
// Seed 1337 (fast-check). In-process generators; ASSUMED: the CI workflow names each deployable, compose.yaml names each node deployable, both carry a generated header.
import fc from "fast-check";
import { expect, test } from "vitest";
import { RUNS, SEED, apply, distinctPair, fresh, lowerName, read } from "./fixtures.ts";

test("Any operation that adds or removes a module or package regenerates `turbo.json`, CI workflows and deploy files (k.topology) from the task graph and topology (ADR-0009).", () => {
  fc.assert(
    fc.property(distinctPair(lowerName), ([a, b]) => {
      const root = apply("project", { name: "shop", adapter: "node" }, new Map()).files;
      const ab = apply("module", { id: b }, apply("module", { id: a }, root).files).files;
      const ba = apply("module", { id: a }, apply("module", { id: b }, root).files).files;
      for (const p of ["turbo.json", ".github/workflows/ci.yml", "deploy/compose.yaml"]) {
        expect(read(ab, p), p).toBe(read(ba, p));
        expect(read(ab, p), p).toMatch(/generated/i);
      }
      const out = apply("module", { id: a }, root);
      expect(out.changed).toContain("turbo.json");
      expect(out.changed).toContain("topology.ts");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

test("removing a module through rename or move leaves turbo.json, CI and deploy files regenerated with no stale module", () => {
  const files = apply("rename", { kind: "module", from: "catalog", to: "market" }, fresh()).files;
  expect(read(files, "turbo.json")).not.toContain("modules/catalog/");
  expect(read(files, ".github/workflows/ci.yml")).not.toContain("catalog");
});
