// Clause: k.scaffold generators — `module`: modules/<id>/module.ts and routes.ts; adds the module to topology.ts.
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, fresh, lowerName, read, word } from "./fixtures.ts";

// seed 1337
it("module adds a manifest modules/<id>/module.ts declaring its id, and a routes.ts", () => {
  fc.assert(
    fc.property(lowerName, (id) => {
      const out = apply("module", { id }, fresh());
      expect(read(out.files, `modules/${id}/module.ts`)).toMatch(new RegExp(`id:\\s*['"]${id}['"]`));
      expect(out.files.has(`modules/${id}/routes.ts`)).toBe(true);
      expect(out.created).toContain(`modules/${id}/module.ts`);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("module is referenced by the deployable (topology.ts)", () => {
  fc.assert(
    fc.property(lowerName, (id) => {
      const before = fresh();
      expect(word(id).test(read(before, "topology.ts"))).toBe(false);
      const out = apply("module", { id }, before);
      expect(word(id).test(read(out.files, "topology.ts"))).toBe(true);
      expect(out.changed).toContain("topology.ts");
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
