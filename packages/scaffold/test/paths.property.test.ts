// Properties of the import-path helpers that move and rename rely on.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { joinSpec } from "../src/internal/joinSpec.ts";
import { relSpec } from "../src/internal/relSpec.ts";
import { restyleSpec } from "../src/internal/restyleSpec.ts";
import { RUNS, SEED } from "./helpers.ts";

const seg = fc.constantFrom("modules", "orders", "catalog", "a", "b");
const file = fc
  .tuple(fc.array(seg, { maxLength: 3 }), fc.constantFrom("X.tsx", "y.ts", "z.store.ts"))
  .map(([d, f]) => [...d, f].join("/"));

describe("paths", () => {
  it("relSpec is a relative specifier that joinSpec resolves back to the target", () => {
    fc.assert(
      fc.property(file, file, (from, to) => {
        const spec = relSpec(from, to);
        expect(spec.startsWith("./") || spec.startsWith("../")).toBe(true);
        expect(joinSpec(from, spec)).toBe(to);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });

  it("restyleSpec keeps the extension style of the original specifier", () => {
    fc.assert(
      fc.property(file, file, file, (from, oldT, newT) => {
        const full = relSpec(from, oldT);
        const bare = full.replace(/\.tsx?$/, "");
        expect(restyleSpec(full, oldT, from, newT)).toBe(relSpec(from, newT));
        expect(restyleSpec(bare, oldT, from, newT)).toBe(relSpec(from, newT).replace(/\.tsx?$/, ""));
        expect(restyleSpec(`${bare}.js`, oldT, from, newT)).toBe(`${relSpec(from, newT).replace(/\.tsx?$/, "")}.js`);
      }),
      { seed: SEED, numRuns: RUNS },
    );
  });
});
