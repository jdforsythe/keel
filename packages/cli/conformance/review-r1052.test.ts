// Spec: k.escapes, clause "R1052 is one finding each for the four folded forms" (the clause text continues in the test name; its directive text cannot sit in a comment, which the structure lint reads as a suppression, and is not disguised).
// Seed: n/a. Pending: `keel review` is not built. Fixture text lives in `unsafe/review-fixtures/` (it is the evasion under test).
import { expect, test } from "vitest";
import { PROJECT, fixture, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

test.skip("R1052 is one finding each for `` `@ts-${'ignore'}` ``, `'@ts' + '-ignore'`, `['@ts', '-ignore'].join('')` and `` String.raw`@ts-ignore` ``; none for `'@types/node'` or `'x @ts-ignore'`.", () => {
  const folded = fixture("folded-directives.ts");
  withRepo([PROJECT, { "modules/m/f.ts": folded }], (repo) => {
    const hits = ofCode(review(repo, [range(repo, 0, 1)]), "R1052");
    expect(hits.map((h) => h.line).sort((a, b) => a - b)).toEqual(
      ["export const a", "export const b", "export const c", "export const d"].map((n) => lineOf(folded, n)),
    );
    for (const h of hits) {
      expect(h.danger).toBe("critical");
      expect(h.loud).toBe("fail");
      expect(h.path).toBe("modules/m/f.ts");
    }
  });
  withRepo([PROJECT, { "modules/m/p.ts": fixture("prose-directives.ts") }], (repo) => {
    expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1052")).toEqual([]);
  });
});
