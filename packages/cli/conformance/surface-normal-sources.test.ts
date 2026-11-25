// Spec: k.compat, clause "After `keel build`, each one of these edits to a file listed in `sources`, alone, leaves `keel check` with no E1005 on `.keel/surface.json`, and the next `keel build` writes it byte for byte the same: swapping two import declarations that bind names; replacing `import { a } from './x.ts'` and `import { b } from './x.ts'` with `import { b, a } from './x.ts'`; adding a line comment and a block comment; re-indenting every line; `\r\n` line endings; a leading byte order mark; writing a string `'k'` as `\"k\"`; adding a trailing comma to a multi-line object literal; removing the semicolon that ends a `const` statement followed by a line starting with `const`; writing `const n = a + b;` as `const n = (a + b);`; writing the key `'k': 1` as `k: 1`; writing `1000` as `1_000`."
// Spec: k.compat, clause "After `keel build`, each one of these edits to a file listed in `sources`, alone, makes `keel check` report one E1005 on `.keel/surface.json` naming that file: changing a string literal's value; swapping two properties of an object literal; swapping two statements that are not import declarations; `import { a } from './x.ts'` becoming `import { a as b } from './x.ts'` with each use of `a` renamed; removing an import declaration; swapping `import './p.ts'` and `import './q.ts'`; changing a type annotation from `string` to `number`; deleting the file; a syntax error in the file (beside its E1000)."
// Spec: k.compat, clause "In a listed `.tsx` file, `<p>Hi there</p>`, `<p>Hi {\"there\"}</p>` and `<p>` on one line, `Hi there` indented on the next and `</p>` on a third have one normal form; `<p>Hi  there</p>` with two spaces does not."
// Seed 1337 (every fc.assert below). Real binary over one temp project built once (surface-normal-support.ts); each case writes one edited file,
// runs `keel check`, and restores the file. The renamed import of the second clause is `a as aa` (the fixture already binds `b`): same edit kind.
// ASSUMED (spec silent): the RFC says the order of binding imports relative to side-effect imports is dropped, so moving a binding import past
// `import './p.ts'` and `import './q.ts'` is asserted as no E1005 (RFC 0217 D4), as part of the composed edits below.
import { rmSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { afterAll, beforeAll, expect, test } from "vitest";
import { cleanup, keel } from "./compat-support.ts";
import {
  SLOW,
  SUBJECT,
  SUBJECT_TEXT,
  VIEW,
  VIEW_TEXT,
  built,
  changes,
  formatterEdits,
  stale,
  staleSurface,
  surfaceText,
  write,
} from "./surface-normal-support.ts";

const SEED = 1337;
let dir = "";
let recorded = "";
beforeAll(() => {
  const b = built();
  dir = b.dir;
  recorded = b.surface;
}, SLOW);
afterAll(() => {
  if (dir !== "") cleanup(dir);
});

const restore = (): void => write(dir, { [SUBJECT]: SUBJECT_TEXT, [VIEW]: VIEW_TEXT });

/** Edits first in the order given, then the `last` ones (they rewrite every line). */
function compose(edits: ReturnType<typeof formatterEdits>, src: string): string {
  const ordered = [...edits.filter((e) => e.last !== true), ...edits.filter((e) => e.last === true)];
  return ordered.reduce((text, e) => e.apply(text), src);
}

test("the fixture is clean before any edit: no E1005 after `keel build`", () => {
  expect(stale(keel(dir, ["check"]))).toEqual([]);
  expect(recorded).toContain(SUBJECT);
  expect(recorded).toContain(VIEW);
});

test(
  "After `keel build`, each one of these edits to a file listed in `sources`, alone, leaves `keel check` with no E1005 on `.keel/surface.json`, and the next `keel build` writes it byte for byte the same: swapping two import declarations that bind names; replacing `import { a } from './x.ts'` and `import { b } from './x.ts'` with `import { b, a } from './x.ts'`; adding a line comment and a block comment; re-indenting every line; `\\r\\n` line endings; a leading byte order mark; writing a string `'k'` as `\"k\"`; adding a trailing comma to a multi-line object literal; removing the semicolon that ends a `const` statement followed by a line starting with `const`; writing `const n = a + b;` as `const n = (a + b);`; writing the key `'k': 1` as `k: 1`; writing `1000` as `1_000`.",
  () => {
    const edits = ["1_000", "1e3", "1000.0"].flatMap((s) =>
      formatterEdits(false, s).filter((e) => e.name.startsWith("1000 written")),
    );
    edits.push(...formatterEdits(false).filter((e) => !e.name.startsWith("1000 written")));
    expect(edits.length).toBeGreaterThan(18);
    for (const e of edits) {
      write(dir, { [SUBJECT]: e.apply(SUBJECT_TEXT) });
      const checked = keel(dir, ["check"]);
      expect(stale(checked), `E1005 after: ${e.name}`).toEqual([]);
      expect(keel(dir, ["build"]).status, `build after: ${e.name}`).toBe(0);
      expect(surfaceText(dir) === recorded, `surface.json bytes after: ${e.name}`).toBe(true);
      restore();
    }
  },
  SLOW,
);

test(
  "After `keel build`, each one of these edits to a file listed in `sources`, alone, leaves `keel check` with no E1005 on `.keel/surface.json` (property: any composition of the edit kinds, any numeric spelling)",
  () => {
    fc.assert(
      fc.property(
        fc.constantFrom("1_000", "1e3", "1000.0", "0b1111101000"),
        fc.shuffledSubarray(
          formatterEdits(true).map((_, i) => i),
          { minLength: 1 },
        ),
        (spelling, picked) => {
          const edits = formatterEdits(true, spelling).filter((_, i) => picked.includes(i));
          write(dir, { [SUBJECT]: compose(edits, SUBJECT_TEXT) });
          expect(stale(keel(dir, ["check"])), edits.map((e) => e.name).join(" + ")).toEqual([]);
          restore();
        },
      ),
      { seed: SEED, numRuns: 6 },
    );
  },
  SLOW,
);

test(
  "After `keel build`, each one of these edits to a file listed in `sources`, alone, makes `keel check` report one E1005 on `.keel/surface.json` naming that file: changing a string literal's value; swapping two properties of an object literal; swapping two statements that are not import declarations; `import { a } from './x.ts'` becoming `import { a as b } from './x.ts'` with each use of `a` renamed; removing an import declaration; swapping `import './p.ts'` and `import './q.ts'`; changing a type annotation from `string` to `number`; deleting the file; a syntax error in the file (beside its E1000).",
  () => {
    for (const c of changes()) {
      if (c.file === "delete") rmSync(join(dir, SUBJECT));
      else write(dir, { [SUBJECT]: c.apply(SUBJECT_TEXT) });
      const checked = keel(dir, ["check"]);
      const found = stale(checked);
      expect(found, `E1005 count after: ${c.name}`).toHaveLength(1);
      expect(String(found[0]?.path), c.name).toMatch(/surface\.json$/);
      expect(String(found[0]?.message), c.name).toContain(SUBJECT);
      if (c.file === "unparsable")
        expect(
          checked.records.some((r) => r.kind === "diag" && r.code === "E1000"),
          "E1000 beside",
        ).toBe(true);
      restore();
    }
  },
  SLOW,
);

test(
  "After `keel build`, each one of these edits to a file listed in `sources`, alone, makes `keel check` report one E1005 on `.keel/surface.json` naming that file (property: any one edit, any new literal, under any formatter edits)",
  () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: changes().length - 1 }),
        fc.stringMatching(/^[a-z]{1,5}$/).filter((v) => v !== "k"),
        fc.shuffledSubarray(formatterEdits(true)),
        (index, value, noise) => {
          const c = changes(value)[index];
          if (c === undefined) throw new Error("index out of range");
          if (c.file === "delete") rmSync(join(dir, SUBJECT));
          else
            write(dir, {
              [SUBJECT]: c.file === undefined ? compose(noise, c.apply(SUBJECT_TEXT)) : c.apply(SUBJECT_TEXT),
            });
          const found = stale(keel(dir, ["check"]));
          expect(found, c.name).toHaveLength(1);
          expect(String(found[0]?.path)).toMatch(/surface\.json$/);
          expect(String(found[0]?.message)).toContain(SUBJECT);
          restore();
        },
      ),
      { seed: SEED, numRuns: 8 },
    );
  },
  SLOW,
);

/** A `.tsx` view whose paragraph holds `children` verbatim. */
const view = (children: string): string =>
  `import { Box } from '@keel/ui'\nexport default function View() {\n  return <Box>${children}</Box>\n}\n`;

test(
  'In a listed `.tsx` file, `<p>Hi there</p>`, `<p>Hi {"there"}</p>` and `<p>` on one line, `Hi there` indented on the next and `</p>` on a third have one normal form; `<p>Hi  there</p>` with two spaces does not.',
  () => {
    const forms = ['Hi {"there"}', "\n    Hi there\n  ", "\n  Hi there\n", "Hi there"];
    for (const f of forms) {
      write(dir, { [VIEW]: view(f) });
      expect(stale(keel(dir, ["check"])), JSON.stringify(f)).toEqual([]);
      expect(keel(dir, ["build"]).status).toBe(0);
      expect(surfaceText(dir) === recorded, `bytes: ${JSON.stringify(f)}`).toBe(true);
    }
    write(dir, { [VIEW]: view("Hi  there") });
    const found = stale(keel(dir, ["check"]));
    expect(found).toHaveLength(1);
    expect(String(found[0]?.path)).toMatch(/surface\.json$/);
    expect(String(found[0]?.message)).toContain(VIEW);
    restore();
  },
  SLOW,
);

test(
  'In a listed `.tsx` file, `<p>Hi there</p>`, `<p>Hi {"there"}</p>` and `<p>` on one line, `Hi there` indented on the next and `</p>` on a third have one normal form (property: any split into text and a string expression child, any indent)',
  () => {
    const text = "Hi there";
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: text.length - 1 }),
        fc.integer({ min: 0, max: 8 }),
        fc.boolean(),
        (at, indent, lines) => {
          const body = `${text.slice(0, at)}{${JSON.stringify(text.slice(at))}}`;
          const pad = " ".repeat(indent);
          write(dir, { [VIEW]: view(lines ? `\n${pad}${text}\n${pad}` : body) });
          expect(stale(keel(dir, ["check"]))).toEqual([]);
          restore();
        },
      ),
      { seed: SEED, numRuns: 6 },
    );
  },
  SLOW,
);

// UNTESTABLE: "`keel check` builds the form only for the files a surface lists, from the parse it makes of each" (Sources) names no observable output; no case.
// Not asserted: the hash's value, which the spec leaves to Keel's own encoding.
