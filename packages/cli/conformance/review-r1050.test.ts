// Spec: k.escapes, clause "R1050 fires for `x as T` in a test file, a `.d.ts`, `vite.config.ts` and `modules/m/unsafe/a.ts`; in `modules/m/a.ts`, where E1757 reports, it does not."
// Seed: n/a. The one cast fixture is copied to each path unchanged.
import { expect, test } from "vitest";
import { PROJECT, fixture, ofCode, range, review, withRepo } from "./review-support.ts";

const PATHS = ["modules/m/c.test.ts", "modules/m/types.d.ts", "vite.config.ts", "modules/m/unsafe/a.ts"];

test("R1050 fires for `x as T` in a test file, a `.d.ts`, `vite.config.ts` and `modules/m/unsafe/a.ts`; in `modules/m/a.ts`, where E1757 reports, it does not.", () => {
  const cast = fixture("cast.ts");
  withRepo([PROJECT, Object.fromEntries(PATHS.map((p) => [p, cast]))], (repo) => {
    const hits = ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1050");
    expect(hits.map((h) => h.path).sort()).toEqual([...PATHS].sort());
  });
  withRepo([PROJECT, { "modules/m/a.ts": cast }], (repo) => {
    expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1050")).toEqual([]);
  });
});
