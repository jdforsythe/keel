// Spec: k.ledger-items, clause "A section `k.x` whose Conformance list is `- A is one.` gives the item `k.x#` and the first 8 hex digits of the SHA-256 of `a is one`, with `n` 1; with `- B is two.` added before it, the same item with `n` 2."
// Spec: k.ledger-items, clause "The bullets ``- `A` is “one”.`` and `- a  is \"one\"` have one key."
// Spec: k.ledger-items, clause "Over a committed ledger holding `k.x`'s clause `A is one.` at `example`, rewording it to `A is two.` makes `keel ledger --diff` report no E1706, and, with `k.x` `conformance-covered` and no file citing `A is two.`, E1707 at that bullet's line naming `k.x#1`."
// Spec: k.ledger-items, clause "Bullets `A is one.` and `a is one` in one section are one E1733 at the second's line, and the ledger holds one item for them."
// Pending (rfc:0235 step 4): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
// Seed: 1337 (every property, 5 runs each: a run is one `keel ledger`). Binary runs: 1 per case, 2 for the two `--diff` cases (`--write`, then `--diff`).
// The real `keel` binary over temp projects (OS tmpdir). A clause record `{ kind: 'ledger', item, rung, evidence, n }` holds `n` (k.ledger-items Clause key).
// The normal form is implemented again in ledger-items-support.ts from the spec's words (backticks dropped, `\"` and typographic quotes made straight,
// white space runs one space, ends trimmed, lower case, one final period dropped); the key literals below are computed apart from it.
// ASSUMED: `--diff` reads the committed ledger at `.keel/ledger.json` as ledger-diff-e1706-cli.test.ts does; "one addition" is read as one E1707 for the new item and no E1706.
import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  SEED,
  SLOW,
  bulletLine,
  citeLine,
  citingFile,
  clauseRecord,
  clausesOf,
  diagsOf,
  inProject,
  itemOf,
  keyOf,
  normalForm,
  specPath,
  specText,
} from "./ledger-items-support.ts";
import { keel, writeFiles } from "./test-sim-project.ts";

const COMMITTED = ".keel/ledger.json";
const T = (name: string): string => `packages/m/conformance/${name}.test.ts`;
const sha8 = (text: string): string => createHash("sha256").update(text, "utf8").digest("hex").slice(0, 8);
const keyIn = (run: Parameters<typeof clausesOf>[0], section: string): string =>
  String(clausesOf(run, section)[0]?.item).split("#")[1] ?? "";

type Section = { bullets: readonly string[]; status?: string; cited?: readonly string[] };
/** A project of the given sections: each a spec file and one conformance file citing its `cited` bullets (all by default). */
const files = (sections: Readonly<Record<string, Section>>): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const [id, s] of Object.entries(sections)) {
    out[specPath(id)] = specText(id, s.bullets, s.status);
    out[T(id)] = citingFile((s.cited ?? s.bullets).map((b) => citeLine(id, b))).source;
  }
  return out;
};

describe("k.ledger-items: a clause is keyed by its text", () => {
  it(
    "a section `k.x` whose Conformance list is `- A is one.` gives the item `k.x#` and the first 8 hex digits of the SHA-256 of `a is one`, with `n` 1",
    () => {
      inProject("items-key-one", files({ "k.x": { bullets: ["A is one."] } }), (dir) => {
        const run = keel(dir, ["ledger"]);
        const recs = clausesOf(run, "k.x");
        expect(recs).toHaveLength(1);
        expect(recs[0]).toMatchObject({ item: `k.x#${sha8("a is one")}`, n: 1, rung: "example" });
        expect(recs[0]?.item).toBe(itemOf("k.x", "A is one."));
      });
    },
    SLOW,
  );

  it(
    "with `- B is two.` added before it, the same item with `n` 2",
    () => {
      inProject("items-key-before", files({ "k.x": { bullets: ["B is two.", "A is one."] } }), (dir) => {
        const run = keel(dir, ["ledger"]);
        expect(clauseRecord(run, `k.x#${sha8("a is one")}`)).toMatchObject({ n: 2, rung: "example" });
        expect(clauseRecord(run, `k.x#${sha8("b is two")}`)).toMatchObject({ n: 1, rung: "example" });
        expect(clausesOf(run, "k.x")).toHaveLength(2);
      });
    },
    SLOW,
  );

  it("for any bullets and any position, a bullet added there changes no other clause's item, and each `n` is its 1-based position (property)", () => {
    const bullet = fc.stringMatching(/^[A-Z][a-z]{2,7}( [a-z]{2,7}){1,4}\.$/);
    fc.assert(
      fc.property(
        fc.uniqueArray(bullet, { minLength: 2, maxLength: 7, selector: normalForm }),
        bullet,
        fc.nat(),
        (list, extra, at) => {
          fc.pre(!list.some((b) => normalForm(b) === normalForm(extra)));
          const pos = at % (list.length + 1);
          const grown = [...list.slice(0, pos), extra, ...list.slice(pos)];
          inProject(
            "items-key-insert",
            files({ "k.a": { bullets: list }, "k.b": { bullets: grown, cited: list } }),
            (dir) => {
              const run = keel(dir, ["ledger"]);
              list.forEach((b, i) => {
                expect(clauseRecord(run, itemOf("k.a", b))).toMatchObject({ n: i + 1, rung: "example" });
                expect(clauseRecord(run, itemOf("k.b", b))).toMatchObject({
                  n: i < pos ? i + 1 : i + 2,
                  rung: "example",
                });
              });
              expect(clausesOf(run, "k.b")).toHaveLength(list.length + 1);
              expect(clauseRecord(run, itemOf("k.b", extra))).toMatchObject({ n: pos + 1, rung: "none" });
            },
          );
        },
      ),
      { seed: SEED, numRuns: 5 },
    );
  }, 600_000);

  it.skip(
    "Over a committed ledger holding `k.x`'s clause `A is one.` at `example`, rewording it to `A is two.` makes `keel ledger --diff` report no E1706, and, with `k.x` `conformance-covered` and no file citing `A is two.`, E1707 at that bullet's line naming `k.x#1`",
    () => {
      const start = files({ "k.x": { bullets: ["A is one."], status: "conformance-covered" } });
      inProject("items-key-reword", start, (dir) => {
        expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
        writeFiles(dir, { [specPath("k.x")]: specText("k.x", ["A is two."], "conformance-covered") });
        const diff = keel(dir, ["ledger", "--diff"]);
        expect(diagsOf(diff, "E1706")).toEqual([]);
        const e1707 = diagsOf(diff, "E1707");
        expect(e1707).toHaveLength(1);
        expect(e1707[0]).toMatchObject({ path: specPath("k.x"), line: bulletLine(1) });
        expect(String(e1707[0]?.message)).toContain("k.x#1");
        expect(diff.status).toBe(1);
        // a removal and an addition: the old item is gone and the new one holds no evidence of the old text's
        expect(clauseRecord(diff, itemOf("k.x", "A is one."))).toBeUndefined();
        expect(clauseRecord(diff, itemOf("k.x", "A is two."))).toMatchObject({ n: 1, rung: "none" });
      });
    },
    SLOW,
  );

  it.skip(
    "a bullet added at position 10 of a 12-bullet section is one addition: `--diff` reports no E1706 and one E1707, at its line, naming `k.x#10`",
    () => {
      const bullets = Array.from({ length: 12 }, (_, i) => `Clause number ${"abcdefghijkl"[i]} holds.`);
      const added = "A new clause holds.";
      const grown = [...bullets.slice(0, 9), added, ...bullets.slice(9)];
      inProject("items-key-ten", files({ "k.x": { bullets, status: "conformance-covered" } }), (dir) => {
        expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
        writeFiles(dir, { [specPath("k.x")]: specText("k.x", grown, "conformance-covered") });
        const diff = keel(dir, ["ledger", "--diff"]);
        expect(diagsOf(diff, "E1706")).toEqual([]);
        const e1707 = diagsOf(diff, "E1707");
        expect(e1707).toHaveLength(1);
        expect(e1707[0]).toMatchObject({ path: specPath("k.x"), line: bulletLine(10) });
        expect(String(e1707[0]?.message)).toContain("k.x#10");
        expect(clausesOf(diff, "k.x")).toHaveLength(13);
        bullets.forEach((b, i) => {
          expect(clauseRecord(diff, itemOf("k.x", b))).toMatchObject({ n: i < 9 ? i + 1 : i + 2, rung: "example" });
        });
        expect(diff.status).toBe(1);
      });
    },
    SLOW,
  );

  it(
    'The bullets ``- `A` is “one”.`` and `- a  is "one"` have one key',
    () => {
      const first = "`A` is “one”.";
      const second = 'a  is "one"';
      inProject("items-key-same", files({ "k.p": { bullets: [first] }, "k.q": { bullets: [second] } }), (dir) => {
        const run = keel(dir, ["ledger"]);
        expect(keyIn(run, "k.p")).toBe(keyIn(run, "k.q"));
        expect(keyIn(run, "k.p")).toBe(sha8('a is "one"'));
      });
    },
    SLOW,
  );

  it("two texts with one normal form have one key, and a one-character change of substance has another (property over backticks, quote style, spacing, case and the final period)", () => {
    const word = fc.stringMatching(/^[a-z]{3,8}$/);
    const base = fc.tuple(word, word, word, word);
    const quoteStyle = fc.constantFrom("straight", "typographic", "escaped");
    fc.assert(
      fc.property(base, quoteStyle, fc.boolean(), fc.boolean(), ([a, b, c, d], style, tick, shout) => {
        const quote = (w: string): string =>
          style === "escaped" ? `\\"${w}\\"` : style === "straight" ? `"${w}"` : `“${w}”`;
        const plain = `${a} ${quote(b)} ${c} ${d}.`;
        const variant = `${tick ? `\`${a}\`` : a}  ${quote(b)}\t${c} ${shout ? d.toUpperCase() : d}${tick ? "" : "."}`;
        const swapped = plain.replace(/[a-z]/, (ch) => (ch === "z" ? "y" : String.fromCharCode(ch.charCodeAt(0) + 1)));
        expect(normalForm(variant)).toBe(normalForm(plain));
        expect(normalForm(swapped)).not.toBe(normalForm(plain));
        inProject(
          "items-key-property",
          files({ "k.p": { bullets: [plain] }, "k.q": { bullets: [variant] }, "k.r": { bullets: [swapped] } }),
          (dir) => {
            const run = keel(dir, ["ledger"]);
            expect(keyIn(run, "k.p")).toBe(keyIn(run, "k.q"));
            expect(keyIn(run, "k.p")).toBe(keyOf(plain));
            expect(keyIn(run, "k.r")).not.toBe(keyIn(run, "k.p"));
          },
        );
      }),
      { seed: SEED, numRuns: 5 },
    );
  }, 600_000);

  it(
    "Bullets `A is one.` and `a is one` in one section are one E1733 at the second's line, and the ledger holds one item for them",
    () => {
      inProject("items-key-e1733", { [specPath("k.x")]: specText("k.x", ["A is one.", "a is one"]) }, (dir) => {
        const run = keel(dir, ["ledger"]);
        const found = diagsOf(run, "E1733");
        expect(found).toHaveLength(1);
        expect(found[0]).toMatchObject({ path: specPath("k.x"), line: bulletLine(2) });
        expect(clausesOf(run, "k.x")).toHaveLength(1);
      });
    },
    SLOW,
  );

  it("for any bullet and a variant of it with one normal form in one section, there is one E1733 at the variant's line and one item (property)", () => {
    const word = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.tuple(word, word), { minLength: 1, maxLength: 3, selector: ([a, b]) => `${a} ${b}` }),
        (pairs) => {
          const tree: Record<string, string> = {};
          pairs.forEach(([a, b], i) => {
            tree[specPath(`k.d${i}`)] = specText(`k.d${i}`, [`${a} is ${b}.`, `\`${a.toUpperCase()}\`  IS ${b}`]);
          });
          inProject("items-key-dup", tree, (dir) => {
            const run = keel(dir, ["ledger"]);
            const found = diagsOf(run, "E1733");
            expect(found).toHaveLength(pairs.length);
            pairs.forEach((_, i) => {
              expect(found).toContainEqual(expect.objectContaining({ path: specPath(`k.d${i}`), line: bulletLine(2) }));
              expect(clausesOf(run, `k.d${i}`)).toHaveLength(1);
            });
          });
        },
      ),
      { seed: SEED, numRuns: 5 },
    );
  }, 600_000);
});
