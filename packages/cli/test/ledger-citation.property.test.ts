// Properties of the clause key and the citation parser (k.ledger-items Clause key, Citation): the normal form ignores
// backticks, quote style, spacing, case and one final period; a formed citation round-trips any quote with `\"`; the
// nearest bullet shares the most words. Seed 1337.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { clauseKey } from "../src/internal/clauseKey.ts";
import { nearestClause } from "../src/internal/nearestClause.ts";
import { normClause } from "../src/internal/normClause.ts";
import { specCitations } from "../src/internal/specCitations.ts";

const SEED = 1337;
const word = fc.stringMatching(/^[a-z]{2,8}$/);
const words = fc.array(word, { minLength: 1, maxLength: 8 });
const lines = (...texts: string[]) => texts.map((text, i) => ({ line: i + 1, text }));

describe("clause key", () => {
  it("is 8 hex digits, one for every spelling with one normal form", () => {
    fc.assert(
      fc.property(words, fc.boolean(), fc.boolean(), (ws, tick, shout) => {
        const plain = `${ws.join(" ")}.`;
        const variant = `${tick ? `\`${ws[0]}\`` : ws[0]}  ${ws.slice(1).join("\t")}`;
        const loud = shout ? variant.toUpperCase() : variant;
        expect(clauseKey(plain)).toMatch(/^[0-9a-f]{8}$/);
        expect(clauseKey(loud)).toBe(clauseKey(plain));
        expect(normClause(`“${plain}”`)).toBe(normClause(`\\"${plain}\\"`));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("drops one final period only", () => {
    expect(normClause("A is one..")).toBe("a is one.");
    expect(normClause(" A is one. ")).toBe("a is one");
  });
});

describe("specCitations", () => {
  it('reads back any quote written with `\\"`, on one line or wrapped', () => {
    fc.assert(
      fc.property(words, fc.boolean(), fc.nat(), (ws, quoted, at) => {
        const quote = quoted ? `${ws[0]} "${ws.slice(1).join(" ")}"` : ws.join(" ");
        const escaped = quote.replaceAll('"', '\\"');
        const one = specCitations(lines(`// Spec: k.x, clause "${escaped}" (E2003)`));
        expect(one).toEqual([{ line: 1, section: "k.x", quote: escaped, formed: true }]);
        const parts = escaped.split(" ");
        const cut = 1 + (at % parts.length);
        const head = parts.slice(0, cut).join(" ");
        const tail = parts.slice(cut).join(" ");
        const wrapped = specCitations(lines(`// Spec: k.x, clause "${head}`, `// ${tail}"`));
        expect(wrapped).toHaveLength(1);
        expect(wrapped[0]?.formed).toBe(true);
        expect(normClause(wrapped[0]?.quote ?? "")).toBe(normClause(quote));
      }),
      { seed: SEED, numRuns: 100 },
    );
  });

  it("marks every other `// Spec:` form unformed and reads no other comment", () => {
    const got = specCitations(
      lines(
        '// Spec: k.x Rules, "A is one."',
        '// Spec: k.x, clause "A is one." "B is two."',
        "// Spec:",
        '// Spec: k.x, clause "open',
        '// k.x, clause "A is one."',
      ),
    );
    expect(got.map((c) => [c.line, c.formed])).toEqual([
      [1, false],
      [2, false],
      [3, false],
      [4, false],
    ]);
    expect(got[0]?.section).toBe("k.x");
    expect(got[2]?.section).toBeUndefined();
  });
});

describe("nearestClause", () => {
  it("is the bullet sharing the most distinct words, the first on a tie, and none without bullets", () => {
    const bullets = [{ text: "A is one." }, { text: "B is two now." }, { text: "B is two later." }];
    expect(nearestClause("B is two.", bullets)).toBe(bullets[1]);
    expect(nearestClause("nothing shared", bullets)).toBe(bullets[0]);
    expect(nearestClause("A", [])).toBeUndefined();
  });
});
