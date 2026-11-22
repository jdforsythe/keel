// Spec: k.escapes, clause "R1052 is one finding each for a TypeScript suppression directive folded from a template with a literal substitution, from `+`, from `.join('')` of two literals and from `String.raw`; none for `'@types/node'`, or for a string holding a directive after other text."
// Seed: n/a. Fixture text lives in `unsafe/review-fixtures/` (it is the evasion under test, and is not disguised).
import { expect, test } from "vitest";
import { PROJECT, fixture, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

test("R1052 is one finding each for a TypeScript suppression directive folded from a template with a literal substitution, from `+`, from `.join('')` of two literals and from `String.raw`; none for `'@types/node'`, or for a string holding a directive after other text.", () => {
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
