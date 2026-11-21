// Spec: k.scaffold, Generators "`module`: `modules/<id>/module.ts`, `<id>.contract.ts` and `routes.ts`; adds the module to `topology.ts`."
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, fresh, lowerName, read, word } from "./fixtures.ts";

// seed 1337
it("module adds a manifest modules/<id>/module.ts declaring its id, a `<id>.contract.ts` and a routes.ts", () => {
  fc.assert(
    fc.property(lowerName, (id) => {
      const out = apply("module", { id }, fresh());
      expect(read(out.files, `modules/${id}/module.ts`)).toMatch(new RegExp(`id:\\s*['"]${id}['"]`));
      expect(out.files.has(`modules/${id}/routes.ts`)).toBe(true);
      const contract = read(out.files, `modules/${id}/${id}.contract.ts`);
      expect(contract).toMatch(new RegExp(`export const ${id} = contract\\(['"]${id}['"]`));
      expect(out.created).toContain(`modules/${id}/${id}.contract.ts`);
      expect(read(out.files, `modules/${id}/routes.ts`)).toContain(`manifest(${id}, `);
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
