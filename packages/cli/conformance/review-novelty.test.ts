// Spec: k.review, clause "A finding at `<head>` only is `new`; with only its line moved, `standing`; with its `unsafe` reason edited, `changed`."
// Seed: 1337 (whitespace runs generated).
// `id` is the first 12 hex characters of the SHA-256 of `<code>\n<path>\n<text>` (k.review Findings); it does not depend on
// where the escape is, so a range that adds a line above it, or re-spaces its text, leaves the same `id`.
import { createHash } from "node:crypto";
import fc from "fast-check";
import { expect, test } from "vitest";
import { PROJECT, SEED, fixture, ofCode, range, review, withRepo } from "./review-support.ts";

const U = (reason: string): string =>
  `import { unsafe } from "@keel/ctx";\nexport const v = unsafe("${reason}", () => 1);\n`;
const ID = /^[0-9a-f]{12}$/;

test("A finding at `<head>` only is `new`; with only its line moved, `standing`; with its `unsafe` reason edited, `changed`.", () => {
  const cast = fixture("cast.ts");
  withRepo([PROJECT, { "modules/m/c.test.ts": cast }, { "modules/m/c.test.ts": `// moved\n${cast}` }], (repo) => {
    const added = ofCode(review(repo, [range(repo, 0, 1)]), "R1050");
    expect(added).toHaveLength(1);
    expect(added[0]?.novelty).toBe("new");
    expect(added[0]?.id).toMatch(ID);
    const moved = ofCode(review(repo, [range(repo, 1, 2)]), "R1050");
    expect(moved).toHaveLength(1);
    expect(moved[0]?.novelty).toBe("standing");
    expect(moved[0]?.id).toBe(added[0]?.id);
    expect(moved[0]?.line).toBe((added[0]?.line ?? 0) + 1);
  });
  withRepo(
    [PROJECT, { "modules/m/u.ts": U("the first reason") }, { "modules/m/u.ts": U("the edited reason") }],
    (repo) => {
      const edited = ofCode(review(repo, [range(repo, 1, 2)]), "R1001");
      expect(edited).toHaveLength(1);
      expect(edited[0]?.novelty).toBe("changed");
      expect(edited[0]?.reason).toBe("the edited reason");
      const first = ofCode(review(repo, [range(repo, 0, 1)]), "R1001");
      expect(first[0]?.novelty).toBe("new");
      expect(first[0]?.reason).toBe("the first reason");
      expect(edited[0]?.id).not.toBe(first[0]?.id);
    },
  );
  // A whitespace run is one space: re-spacing the escape's own text is `standing`, with the same id.
  fc.assert(
    fc.property(fc.constantFrom(" ", "  ", "\t", "   ", " \t "), (gap) => {
      const respaced = `// Fixture\nexport const n = 1${gap}as${gap}number;\n`;
      const plain = "// Fixture\nexport const n = 1 as number;\n";
      return withRepo([PROJECT, { "modules/m/c.test.ts": plain }, { "modules/m/c.test.ts": respaced }], (repo) => {
        const a = ofCode(review(repo, [range(repo, 0, 1)]), "R1050");
        const b = ofCode(review(repo, [range(repo, 1, 2)]), "R1050");
        expect(b[0]?.novelty).toBe("standing");
        expect(b[0]?.id).toBe(a[0]?.id);
        return true;
      });
    }),
    { seed: SEED, numRuns: 5 },
  );
});

test("`id` is the first 12 lowercase hex characters of the SHA-256 of `<code>\n<path>\n<text>`, whitespace runs as one space, with `#<n>` for the nth repeat in a file.", () => {
  const sha = (s: string): string => createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
  const one = `import { unsafe } from "@keel/ctx";\nexport const v = unsafe("a reason", () => 1);\n`;
  withRepo([PROJECT, { "modules/m/u.ts": one }], (repo) => {
    const hit = ofCode(review(repo, ["--all"]), "R1001");
    expect(hit).toHaveLength(1);
    expect(hit[0]?.id).toBe(sha('R1001\nmodules/m/u.ts\nunsafe("a reason", () => 1)'));
  });
  const twice = `import { unsafe } from "@keel/ctx";\nexport const v = unsafe("same", () => 1);\nexport const w = unsafe("same",   () => 1);\n`;
  withRepo([PROJECT, { "modules/m/u.ts": twice }], (repo) => {
    const ids = ofCode(review(repo, ["--all"]), "R1001")
      .sort((a, b) => a.line - b.line)
      .map((f) => f.id);
    expect(ids).toEqual([
      sha('R1001\nmodules/m/u.ts\nunsafe("same", () => 1)'),
      sha('R1001\nmodules/m/u.ts\nunsafe("same", () => 1)#1'),
    ]);
  });
});
