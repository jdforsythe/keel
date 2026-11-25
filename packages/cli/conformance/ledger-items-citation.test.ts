// Spec: k.ledger-items, clause "`// Spec: k.x, clause \"a is one\"`, and `// Spec: k.x, clause \"A is` with `// one.\"` on the next line, each cite `A is one.`; `// Spec: k.x, clause \"A is\"` cites nothing and is E1732 at its line."
// Spec: k.ledger-items, clause "The bullet `` `\"hi\"` is shown.`` is cited by `// Spec: k.x, clause \"\"hi\" is shown.\"`; `// Spec: k.x, clause \"\"hi\" is shown.\"` is E1732."
// Spec: k.ledger-items, clause "With bullets `A is one.` and `B is two now.` in `k.x`, `// Spec: k.x, clause \"B is two.\"` is one E1732 whose message holds `B is two.` and `k.x#2`."
// Spec: k.ledger-items, clause "`// Spec: k.nope, clause \"A is one.\"`, `// Spec: k.x Rules, \"A is one.\"` and `// Spec: k.x, clause \"A is one.\" \"B is two now.\"` are each one E1732."
// Seed: 1337 (the two properties, 5 runs each). Binary runs: 1 for every fixed case (one project of eleven sections, read by one `keel ledger`), 1 per property run.
// Each section of the shared project holds its own spec file and conformance files, so a file's citation is read apart from the others'.
// ASSUMED: E1732's `path` is the conformance file and its `line` the 1-based line of the `// Spec:` line; "a note holding `\"`" is read as a `// Spec:` line of another form (E1732);
// a `// Spec:` line after the file's first statement other than an import is no header line and is not read.
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import {
  SEED,
  SLOW,
  citingFile,
  clauseRecord,
  diagsOf,
  inProject,
  itemOf,
  normalForm,
  specPath,
  specText,
} from "./ledger-items-support.ts";
import { type Run, keel, makeProject, removeProject } from "./test-sim-project.ts";

const T = (name: string): string => `packages/m/conformance/${name}.test.ts`;
const ONE = "A is one.";
const TWO = "B is two now.";
const HI = '`"hi"` is shown.';

/** One section per case: its spec bullets and the conformance files citing it (each a header and its test). */
type Case = { bullets: readonly string[]; files: Readonly<Record<string, readonly string[]>> };
const CASES: Readonly<Record<string, Case>> = {
  "k.a": { bullets: [ONE], files: { a: ['// Spec: k.a, clause "a is one"'] } },
  "k.b": { bullets: [ONE], files: { b: ['// Spec: k.b, clause "A is', '// one."'] } },
  "k.c": { bullets: [ONE], files: { c: ['// Spec: k.c, clause "A is"'] } },
  "k.d": { bullets: [HI], files: { d: ['// Spec: k.d, clause "\\"hi\\" is shown."'] } },
  "k.e": { bullets: [HI], files: { e: ['// Spec: k.e, clause ""hi" is shown."'] } },
  "k.f": { bullets: [ONE, TWO], files: { f: ['// Spec: k.f, clause "B is two."'] } },
  "k.g": {
    bullets: [ONE, TWO],
    files: {
      "g-nope": ['// Spec: k.nope, clause "A is one."'],
      "g-rules": ['// Spec: k.g Rules, "A is one."'],
      "g-two": ['// Spec: k.g, clause "A is one." "B is two now."'],
    },
  },
  "k.h": {
    bullets: [ONE, TWO],
    files: {
      "h-comma": ['// Spec: k.h clause "A is one."'],
      "h-bare": ['// Spec: k.h, "A is one."'],
      "h-label": ['// Spec: k.h, Conformance "A is one."'],
      "h-single": ["// Spec: k.h, clause 'A is one.'"],
      "h-nosection": ['// Spec: , clause "A is one."'],
      "h-empty": ["// Spec:"],
      "h-open": ['// Spec: k.h, clause "A is one.'],
    },
  },
  "k.i": {
    bullets: [ONE, TWO],
    files: {
      "i-plain": ['// k.i Rules "A is one."', '// Conformance "B is two now."'],
      "i-after": ["// A header with no citation."],
    },
  },
  "k.j": {
    bullets: [ONE, TWO],
    files: {
      "j-note": ['// Spec: k.j, clause "A is one." (E2003)'],
      "j-rfc": ['// Spec: k.j, clause "B is two now." (rfc:0079)'],
    },
  },
  "k.l": { bullets: [ONE], files: { "l-quote-in-note": ['// Spec: k.l, clause "A is one." (the "note")'] } },
};

const made: string[] = [];
afterAll(() => {
  for (const d of made) removeProject(d);
});

const treeOf = (cases: Readonly<Record<string, Case>>): Record<string, string> => {
  const tree: Record<string, string> = {};
  for (const [id, c] of Object.entries(cases)) {
    tree[specPath(id)] = specText(id, c.bullets);
    for (const [name, header] of Object.entries(c.files)) {
      tree[T(name)] = citingFile(header).source;
      if (name === "i-after") {
        // a `// Spec:` line after the first statement is no header line
        tree[T(name)] = `${tree[T(name)]}// Spec: k.nope, clause "never read"\n`;
      }
    }
  }
  return tree;
};

let shared: Run | undefined;
const sharedRun = (): Run => {
  if (shared === undefined) {
    const dir = makeProject("items-cite", treeOf(CASES));
    made.push(dir);
    shared = keel(dir, ["ledger"]);
  }
  return shared;
};
const at = (run: Run, file: string) => diagsOf(run, "E1732").filter((d) => d.path === T(file));
const rung = (run: Run, id: string, bullet: string): unknown => clauseRecord(run, itemOf(id, bullet))?.rung;

describe("k.ledger-items: a citation is one `// Spec:` line of one form", () => {
  it(
    '`// Spec: k.x, clause "a is one"` cites `A is one.`',
    () => {
      const run = sharedRun();
      expect(rung(run, "k.a", ONE)).toBe("example");
      expect(at(run, "a")).toEqual([]);
    },
    SLOW,
  );

  it(
    '`// Spec: k.x, clause "A is` with `// one."` on the next line cites `A is one.`',
    () => {
      const run = sharedRun();
      expect(rung(run, "k.b", ONE)).toBe("example");
      expect(at(run, "b")).toEqual([]);
    },
    SLOW,
  );

  it(
    '`// Spec: k.x, clause "A is"` cites nothing and is E1732 at its line',
    () => {
      const run = sharedRun();
      expect(rung(run, "k.c", ONE)).toBe("none");
      expect(at(run, "c")).toEqual([expect.objectContaining({ line: 1 })]);
    },
    SLOW,
  );

  it(
    'The bullet `` `"hi"` is shown.`` is cited by `// Spec: k.x, clause "\\"hi\\" is shown."`',
    () => {
      const run = sharedRun();
      expect(rung(run, "k.d", HI)).toBe("example");
      expect(at(run, "d")).toEqual([]);
    },
    SLOW,
  );

  it(
    '`// Spec: k.x, clause ""hi" is shown."` is E1732',
    () => {
      const run = sharedRun();
      expect(rung(run, "k.e", HI)).toBe("none");
      expect(at(run, "e")).toEqual([expect.objectContaining({ line: 1 })]);
    },
    SLOW,
  );

  it(
    'With bullets `A is one.` and `B is two now.` in `k.x`, `// Spec: k.x, clause "B is two."` is one E1732 whose message holds `B is two.` and `k.x#2`',
    () => {
      const run = sharedRun();
      const found = at(run, "f");
      expect(found).toHaveLength(1);
      expect(found[0]).toMatchObject({ line: 1 });
      expect(String(found[0]?.message)).toContain("B is two.");
      expect(String(found[0]?.message)).toContain("k.f#2");
    },
    SLOW,
  );

  it(
    '`// Spec: k.nope, clause "A is one."`, `// Spec: k.x Rules, "A is one."` and `// Spec: k.x, clause "A is one." "B is two now."` are each one E1732',
    () => {
      const run = sharedRun();
      for (const file of ["g-nope", "g-rules", "g-two"])
        expect(at(run, file)).toEqual([expect.objectContaining({ line: 1 })]);
      expect(rung(run, "k.g", ONE)).toBe("none");
      expect(rung(run, "k.g", TWO)).toBe("none");
    },
    SLOW,
  );

  it(
    "a `// Spec:` line of any other form (no comma, no `clause`, a label, single quotes, no section, no quote, a quote still open) is one E1732 at its line and cites nothing",
    () => {
      const run = sharedRun();
      for (const file of Object.keys(CASES["k.h"]?.files ?? {})) {
        expect(at(run, file), file).toEqual([expect.objectContaining({ line: 1 })]);
      }
      expect(rung(run, "k.h", ONE)).toBe("none");
    },
    SLOW,
  );

  it(
    "no other comment is read: a quote of a bullet in a comment that is no `// Spec:` line cites nothing and is no E1732, and a `// Spec:` line after the first statement is not read",
    () => {
      const run = sharedRun();
      expect(at(run, "i-plain")).toEqual([]);
      expect(at(run, "i-after")).toEqual([]);
      expect(rung(run, "k.i", ONE)).toBe("none");
      expect(rung(run, "k.i", TWO)).toBe("none");
    },
    SLOW,
  );

  it(
    'text after the closing quote that holds no `"` is a note and cites as without it; a note holding `"` is E1732',
    () => {
      const run = sharedRun();
      expect(at(run, "j-note")).toEqual([]);
      expect(at(run, "j-rfc")).toEqual([]);
      expect(rung(run, "k.j", ONE)).toBe("example");
      expect(rung(run, "k.j", TWO)).toBe("example");
      expect(at(run, "l-quote-in-note")).toEqual([expect.objectContaining({ line: 1 })]);
    },
    SLOW,
  );

  it("a quote that differs from a bullet only by backticks, quote style, spacing, case and the final period cites it, and one character of substance more or less does not (property)", () => {
    const word = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(
        fc.tuple(word, word, word),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        ([a, b, c], tick, shout, period) => {
          const bullet = `${a[0]?.toUpperCase()}${a.slice(1)} \`${b}\` is “${c}”.`;
          const same = `${shout ? a.toUpperCase() : a}   ${tick ? b : `\`${b}\``} is \\"${c}\\"${period ? "." : ""}`;
          const other = `${a} ${b} is \\"${c}x\\".`;
          expect(normalForm(same)).toBe(normalForm(bullet));
          const tree = {
            [specPath("k.p")]: specText("k.p", [bullet]),
            [specPath("k.q")]: specText("k.q", [bullet]),
            [T("p")]: citingFile([`// Spec: k.p, clause "${same}"`]).source,
            [T("q")]: citingFile([`// Spec: k.q, clause "${other}"`]).source,
          };
          inProject("items-cite-prop", tree, (dir) => {
            const run = keel(dir, ["ledger"]);
            expect(rung(run, "k.p", bullet)).toBe("example");
            expect(at(run, "p")).toEqual([]);
            expect(rung(run, "k.q", bullet)).toBe("none");
            expect(at(run, "q")).toEqual([expect.objectContaining({ line: 1 })]);
          });
        },
      ),
      { seed: SEED, numRuns: 5 },
    );
  }, 600_000);

  it('a `"` of a bullet is written `\\"` in a quote: for any quoted words, the escaped quote cites the bullet and the quote with raw `"` is E1732 (property)', () => {
    const word = fc.stringMatching(/^[a-z]{3,8}$/);
    fc.assert(
      fc.property(fc.tuple(word, word), ([a, b]) => {
        const bullet = `Say "${a}" and "${b}" now.`;
        const tree = {
          [specPath("k.p")]: specText("k.p", [bullet]),
          [specPath("k.q")]: specText("k.q", [bullet]),
          [T("p")]: citingFile([`// Spec: k.p, clause "Say \\"${a}\\" and \\"${b}\\" now."`]).source,
          [T("q")]: citingFile([`// Spec: k.q, clause "${bullet}"`]).source,
        };
        inProject("items-cite-esc", tree, (dir) => {
          const run = keel(dir, ["ledger"]);
          expect(rung(run, "k.p", bullet)).toBe("example");
          expect(at(run, "p")).toEqual([]);
          expect(rung(run, "k.q", bullet)).toBe("none");
          expect(at(run, "q")).toEqual([expect.objectContaining({ line: 1 })]);
        });
      }),
      { seed: SEED, numRuns: 5 },
    );
  }, 600_000);
});
