// k.scaffold, Generators "`component`: `<Name>.tsx` with a `Props` schema and a property test (k.testing)."
import fc from "fast-check";
import { expect, it } from "vitest";
import { RUNS, SEED, apply, esc, fresh, pascalName, read } from "./fixtures.ts";

// seed 1337
it("component creates <Name>.tsx with a default export named Name and a Props schema", () => {
  fc.assert(
    fc.property(pascalName, (name) => {
      const out = apply("component", { id: `orders/${name}` }, fresh());
      const file = out.created.find((p) => p.endsWith(`/${name}.tsx`) || p === `${name}.tsx`);
      expect(file).toBeDefined();
      const src = read(out.files, file ?? "");
      expect(src).toMatch(new RegExp(`export\\s+default\\s+(?:function\\s+)?${esc(name)}\\b`));
      expect(src).toMatch(/export\s+const\s+Props\s*=\s*s\.object\(/);
      expect((src.match(/^export\s+default\b/gm) ?? []).length).toBe(1);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});

it("component creates a property test beside the component", () => {
  fc.assert(
    fc.property(pascalName, (name) => {
      const out = apply("component", { id: `orders/${name}` }, fresh());
      expect(out.created.some((p) => p.includes(name) && /\.test\.tsx?$/.test(p))).toBe(true);
    }),
    { seed: SEED, numRuns: RUNS },
  );
});
