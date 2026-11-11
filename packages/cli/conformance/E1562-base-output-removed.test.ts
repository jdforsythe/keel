// Spec: k.compat, clause "Removing an output field a base endpoint requires is one E1562 with no fix; adding a field to an open output object is none."
// Seed 1337. Cross-deployable caller `a` (deployable x) of route `y.save` (deployable y).
import fc from "fast-check";
import { afterAll, expect, test } from "vitest";
import { SEED, baseSurface, buildAndCheck, cleanup, diags, project, write } from "./compat-support.ts";

/** Property runs spawn several `keel build` and `keel check` processes each. */
const SLOW = 120_000;

const dirs: string[] = [];
afterAll(() => {
  for (const d of dirs) cleanup(d);
});
const field = fc.constantFrom("title", "total", "status");

test(
  "Removing an output field a base endpoint requires is one E1562 with no fix; adding a field to an open output object is none.",
  () => {
    fc.assert(
      fc.property(field, (f) => {
        const both = `s.object({ id: s.string(), ${f}: s.string() })`;
        const onlyId = "s.object({ id: s.string() })";
        const value = (withField: boolean): string => (withField ? `{ id: 'i', ${f}: 'v' }` : "{ id: 'i' }");
        const { dir, base } = baseSurface(project({ output: both, outputValue: value(true), split: true }));
        dirs.push(dir);

        write(dir, project({ output: onlyId, outputValue: value(false), endpointOutput: both, split: true }));
        const removed = diags(buildAndCheck(dir, base), "E1562");
        expect(removed).toHaveLength(1);
        expect(String(removed[0]?.message)).toContain(f);
        expect(removed[0]?.fix).toBeUndefined();

        const extra = `s.object({ id: s.string(), ${f}: s.string(), more: s.string() })`;
        write(
          dir,
          project({
            output: extra,
            outputValue: `{ id: 'i', ${f}: 'v', more: 'm' }`,
            endpointOutput: both,
            split: true,
          }),
        );
        expect(diags(buildAndCheck(dir, base), "E1562")).toEqual([]);
      }),
      { seed: SEED, numRuns: 3 },
    );
  },
  SLOW,
);
