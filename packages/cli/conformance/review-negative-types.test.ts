// Spec: k.unsafe, clause "`keel review` reports no R1050 for `// @ts-expect-error a page guard needs a redirect` in `test/a.test-d.ts` of a range adding it, and one R1050 for `// @ts-expect-error` with nothing after it there."
// Seed 1337 (the property). `keel review --list` over a temp git repository (review-support.ts): the range adds the file
// under test. Directive text is built from constants so this file's own source holds none.
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { PROJECT, lineOf, ofCode, range, review, withRepo } from "./review-support.ts";

const EXPECT = `@ts-${"expect-error"}`;
const IGNORE = `@ts-${"ignore"}`;
const SEED = 1337;

/** `keel review --list` R1050 findings for `source` added at `path`. */
const r1050 = (path: string, source: string) =>
  withRepo([PROJECT, { [path]: source }], (repo) => ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1050"));

const described = (why: string): string => `// ${EXPECT} ${why}\nexport const n: string = 1;\n`;
const description = fc.stringMatching(/^[a-z][a-z ]{0,30}$/);

describe("k.unsafe: R1050 skips a described expectation", () => {
  test("`keel review` reports no R1050 for `// @ts-expect-error a page guard needs a redirect` in `test/a.test-d.ts` of a range adding it", () => {
    expect(r1050("test/a.test-d.ts", described("a page guard needs a redirect"))).toEqual([]);
  });

  test("and one R1050 for `// @ts-expect-error` with nothing after it there", () => {
    const src = `// ${EXPECT}\nexport const n: string = 1;\n`;
    const hits = r1050("test/a.test-d.ts", src);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe("test/a.test-d.ts");
    expect(hits[0]?.line).toBe(lineOf(src, EXPECT));
  });

  test("property: any description holding a letter is skipped in a negative type test under `test/` or `conformance/`", () => {
    fc.assert(
      fc.property(
        description,
        fc.constantFrom("test/a.test-d.ts", "conformance/a.test-d.ts", "modules/m/test/a.test-d.ts"),
        (why, path) => {
          expect(r1050(path, described(why))).toEqual([]);
        },
      ),
      { seed: SEED, numRuns: 6 },
    );
  });

  test("`@ts-ignore` with a description is one R1050 in a negative type test", () => {
    const src = `// ${IGNORE} a number is no string\nexport const n: string = 1;\n`;
    expect(r1050("test/a.test-d.ts", src)).toHaveLength(1);
  });

  test("a described expectation in a test file that is not a negative type test stays one R1050", () => {
    expect(r1050("test/a.test.ts", described("a page guard needs a redirect"))).toHaveLength(1);
  });
});
