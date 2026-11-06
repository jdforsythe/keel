// Clause: k.scaffold generators — `store`: *.schema.ts, store file, invariant test; k.store: id is <module>.<export>.
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, fresh, lowerName, read, word } from "./fixtures.ts";

// seed 1337
it("store creates a *.store.ts whose store id is <module>.<export>", () => {
  fc.assert(
    fc.property(lowerName, (name) => {
      const out = apply("store", { id: `orders.${name}` }, fresh());
      const file = out.created.find((p) => p.endsWith(`${name}.store.ts`));
      expect(file).toBeDefined();
      const src = read(out.files, file ?? "");
      expect(word(name).test(src)).toBe(true);
      // either the id is explicit and correct, or the compiler derives it from the export name
      const explicit = src.match(/id:\s*['"]([^'"]+)['"]/);
      if (explicit) expect(explicit[1]).toBe(`orders.${name}`);
      else expect(src).toMatch(new RegExp(`export\\s+const\\s+${name}\\b`));
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("store creates a *.schema.ts and an invariant test", () => {
  fc.assert(
    fc.property(lowerName, (name) => {
      const out = apply("store", { id: `orders.${name}` }, fresh());
      expect(out.created.some((p) => p.endsWith(".schema.ts"))).toBe(true);
      expect(out.created.some((p) => /\.test\.ts$/.test(p))).toBe(true);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
