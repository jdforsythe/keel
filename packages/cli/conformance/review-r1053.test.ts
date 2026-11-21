// Spec: k.escapes, clause "R1053 is one finding each for `import(name)`, `require(a + b)` and `import(['vi', 'test'].join(''))`; `import('./a.ts')` and `` import(`./a.ts`) `` are none."
// Seed: n/a. Pending: `keel review` is not built. Computed specifiers live in `unsafe/review-fixtures/` (the evasion under test).
import { expect, test } from "vitest";
import { PROJECT, fixture, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

test("R1053 is one finding each for `import(name)`, `require(a + b)` and `import(['vi', 'test'].join(''))`; `import('./a.ts')` and `` import(`./a.ts`) `` are none.", () => {
  const computed = fixture("computed-specifiers.ts");
  withRepo([PROJECT, { "modules/m/i.ts": computed }], (repo) => {
    const hits = ofCode(review(repo, [range(repo, 0, 1)]), "R1053");
    expect(hits.map((h) => h.line).sort((a, b) => a - b)).toEqual(
      ["void import(name)", "void require(a + b)", 'void import(["vi"'].map((n) => lineOf(computed, n)),
    );
    for (const h of hits) expect(h.loud).toBe("fail");
  });
  const literal = 'export {};\nvoid import("./a.ts");\nvoid import(`./a.ts`);\n';
  withRepo([PROJECT, { "modules/m/l.ts": literal }], (repo) => {
    expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1053")).toEqual([]);
  });
});
