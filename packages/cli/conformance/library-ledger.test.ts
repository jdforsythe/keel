// Spec: k.library, the four clauses on the ledger over libraries, each quoted whole:
// 13. "In that project, with no `.keel/ledger.json` in the library, `keel check` reports one E1162 at the `'@acme/charts'` entry, message `@acme/charts ships no .keel/ledger.json`, and two, one at each entry, when `modules/admin/module.ts` also lists `'@acme/charts'` in `deps`; with `unsafe/u.ts` holding one `unsafe(...)` call and a ledger file whose `unsafe` is 0 and `hostElements` 2, two E1162 at the entry, messages `@acme/charts ships unsafe 0, its files hold 1` then `@acme/charts ships hostElements 2, its files hold 0`; with the linked library of the fourth bullet and no ledger file, none."
// 14. "In that project, a library `.keel/ledger.json` holding `not json`, `{"version":1,"unsafe":0,"hostElements":0}`, `{"version":1,"unsafe":0,"hostElements":-1,"exports":[]}` or `{"version":1,"unsafe":0,"hostElements":0,"exports":[{"pkg":"charts","name":"Badge","file":"src/Badge.tsx","rung":"tested"}]}` is one E1162 at the `'@acme/charts'` entry, message `@acme/charts .keel/ledger.json ` followed by `is not a JSON object`, `fails its shape at exports`, `fails its shape at hostElements` and `fails its shape at exports` in turn; one holding `{"version":1,"unsafe":0,"hostElements":0,"exports":[],"extra":true}` is none."
// 15. "In that project, with `unsafe/u.ts` holding one `unsafe(...)` call and the library's `.keel/ledger.json` holding `unsafe` 1 and `exports` `[{ "pkg": "charts", "name": "Badge", "file": "src/Badge.tsx", "rung": "example" }]`, `keel ledger` emits `{ kind: 'ledger', item: '@acme/charts/src/Badge.tsx#Badge', rung: 'example', evidence: 'library 1.0.0' }` as its last `ledger` record; with that file's `exports` `[]` instead it emits no record whose item starts with `@acme/charts/`, and the two runs give equal summary `counts`, and with `--write .keel/ledger.json` byte-equal files, whose `unsafe` is 1 and whose `libraries` is `{ "@acme/charts": { "version": "1.0.0", "unsafe": 1, "hostElements": 0 } }`; with `modules/shop/module.ts` listing no `'@acme/charts'`, `--write` writes `unsafe` 0 and `libraries` `{}`."
// 16. "In that project, with `unsafe/u.ts` holding no `unsafe(...)` call and the library's `exports` holding the `Badge` entry at `example`, after `keel ledger --write .keel/ledger.json`, changing that entry's `rung` to `none` makes `keel ledger --diff` report no diagnostic, and adding one `unsafe(...)` call to `unsafe/u.ts` makes it report one E1706, message `unsafe count up 0 -> 1`."
// k.library, Rules, E1162: "E1162 an installed library's `.keel/ledger.json` missing, not a JSON object, failing its shape, or else holding an `unsafe` or `hostElements` other than the app's count over the library's files, at each `deps` entry of an app or library manifest naming it, from `keel check` alone (messages: k.library-pack Ledger file; fix: none)"
// k.library, Ledger: "A published library carries `.keel/ledger.json`, written by its own `keel ledger --write` (k.ledger File). The app's `keel ledger` counts `unsafe` and `hostElements` over each library's files as over its own (k.host-element Ledger), so adding a library holding either is E1706 under `--diff` until the ledger is written again; a library file the project's own read holds at a path that count reads (a library at `packages/<pkg>/` of a workspace) is counted once, as the project's. A library is installed when its real path lies inside a `node_modules` folder, else linked. Per entry of an installed library's ledger `exports` (libraries by name, entries in file order), `keel ledger` emits `{ kind: 'ledger', item: '<name>/<file>#<export>', rung, evidence: 'library <version>' }`, `<version>` its `package.json` `version`, after the project's `ledger` records; `--scope` keeps one whose item starts with it, as any item (`@acme/charts/` keeps one library's). The app ran none of that evidence: the summary `counts`, the written `exports` and `rungs`, and `--diff` leave them out. A file E1162 fails (missing, misshapen, or stating other counts) adds none. The written `libraries` has an entry per library of the app, installed or linked, names sorted: its `package.json` `version` and the app's counts of its `unsafe` and `hostElements` over all its files, never its file's."
// k.library-pack, Ledger file: "The app reads at most 262,144 UTF-8 bytes of an installed library's `.keel/ledger.json` (k.library Ledger), as `JSON.parse` does (of duplicate keys, the last wins), on `version`, `unsafe`, `hostElements` and `exports` alone, as k.ledger File gives them; other keys are not judged. E1162 (k.library), from `keel check` alone (`keel ledger` takes a failing file as none: its items are not shown, its counts recounted), has five messages, each whole within 89 units for a name of up to 38 units and counts of up to six digits: `<name> ships no .keel/ledger.json` (the name and 27 units: 65); `<name> .keel/ledger.json is over 262144 bytes` (39: 77), the file read no further; `<name> .keel/ledger.json is not a JSON object` (39: 77) for an empty file, text that is not JSON, or JSON other than an object (an array, `null`, a number, a string, a boolean); `<name> .keel/ledger.json fails its shape at <key>` (38 and the key, at most 12: 88), `<key>` the first of `version`, `unsafe`, `hostElements` and `exports` missing or holding a wrong value (an `exports` entry with a field missing or of another type is a wrong value); else `<name> ships <field> <shipped>, its files hold <counted>` (25, the field, at most 12, and both counts' digits: 87 at `hostElements` with a shipped 999999 and a counted 100000 to 999999; a longer count lengthens it), one per field that differs, `unsafe` at the entry's opening quote and `hostElements` a column after it, so `unsafe` sorts first."
// k.ledger, File: "`keel ledger --write <file>` writes `{ version, unsafe, hostElements, negativeTypes, rungs, mutation, exports, clauses, a11y, libraries }`, keys in that order, as `JSON.stringify(value, null, 2)` and a line feed. `version` is 1; `unsafe`, `hostElements` and `negativeTypes` (k.unsafe) are counts; `rungs` is `{ example, probabilistic, exhaustive, proven, monitored }`; `mutation`, written only when it holds a package or a claim, is `{ packages, claims }`, `packages` keyed by package folder name, each `{ score, scoreJustified, threshold, killed, survived, noCoverage, justified }` (`score` and `scoreJustified` percents to two decimals, absent while the package has no fresh mutant), `claims` `[{ file, sha, killed, survived, noCoverage, justified, score }]` (Mutation) ordered by `file`; `exports` is `[{ pkg, name, file, rung }]` ordered by `<file>#<name>`, `file` a package export's repository path, an app export's `<app>:<path under modules/>`, a library's path from its folder (k.library-pack Own folder), and `pkg` the package's or app's folder name or the library's `id`; `clauses` is `[{ item, rung }]`, `item` `<section>#<n>`, ordered by spec file path, then `n`; `a11y` is `[{ item, rung }]`, `rung` `none` or `example`, ordered by the project's `.keel/routes.json` path, route id, then criterion number; `libraries` is `{ [name]: { version, unsafe, hostElements } }` (k.library Ledger), `{}` when there is none. Keys and orders are UTF-16 code-unit orders; a `rung` is one of the six Ledger names. A file read holds this shape when it is a JSON object whose `version` is 1, `unsafe` and `hostElements` are integers, `hostElements` not negative, and whose `exports` is such an array, an entry with a field missing or of another type failing it; `negativeTypes`, `rungs`, `mutation`, `clauses`, `a11y` and `libraries` may be absent and, present, hold their form (a library's file is judged on the first four alone, k.library-pack Ledger file), and so may a package's counts and scores and a claim's `justified` be absent; other keys are ignored. `rungs` counts, per rung, the items with evidence on it; `mutation` holds each package's `{ score, scoreJustified, threshold, killed, survived, noCoverage, justified }`, the counts summed over its fresh claims, and the claims, a report on disk replacing its files' claims only, a claim with no file dropped, and a file the report holds with no scored mutant (all ignored) loses its claim. An `a11y` item of a project with no `reports/a11y.json` on disk keeps the rung the committed file holds; one whose report is present is computed again, and one whose route is gone is dropped. The summary `counts` carry `rungs`, `stale` and `keptNoReport` (the kept items). E1005 (k.compiler) skips an app's `.keel/ledger.json` and `monitored.json`. `--diff` compares with the committed ledger, reading reports as `--write` does."
// "That project" is the first Conformance clause of k.library (library-support.ts builds it in a temporary project; `keel` runs as the real binary). Seed 1337.
// ASSUMPTIONS (spec silent, readings asserted):
//  - A library file at `packages/charts` through a link inside the project root is read by the project's own count (k.library Ledger names `packages/<pkg>/`).
//  - A linked library's `libraries` entry is written (the clause says "installed or linked"); a file outside `src/` and `unsafe/` is not counted (k.library In an app).
//  - The byte bound is read as bytes of the file's UTF-8 text (multi-byte characters count their bytes); duplicate keys: the last value is the one read and judged.
//  - "a failing file" in k.library-pack is read as any of the five E1162 faults, the differing count included; k.library Ledger says "A file E1162 fails (missing, misshapen, or stating other counts) adds none".
//  - The 87-unit bound of the counts message is asserted whole at a shipped 999999 and a counted 100000 `hostElements` (100000 `Host` elements in the library's files).
//  - Past six digits only the template is asserted (the 89-unit bound is for counts of up to six digits).
import { existsSync, mkdirSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import {
  LIB,
  NAME,
  SEED,
  SLOW,
  type Rec,
  type Tree,
  atEntryOf,
  badgeEntry,
  cleanup,
  countsOf,
  diags,
  hostFiles,
  keel,
  ledgerRecs,
  library,
  linkBeside,
  linkInside,
  materialize,
  project,
  shipped,
  unsafeSrc,
  writeLedger,
} from "./library-support.ts";
import { manifestSrc } from "./boundary-support.ts";

const RUNGS = ["none", "example", "probabilistic", "exhaustive", "proven", "monitored"] as const;
const E1162 = "E1162";

/** `keel check` over `tree`, the temporary project removed after. */
function checkOf(tree: Tree, code = E1162): Rec[] {
  const dir = materialize(tree);
  try {
    return diags(keel(dir, ["check"]), code);
  } finally {
    cleanup(dir);
  }
}

/** The project with the library's `.keel/ledger.json` holding `text` (the file absent when `text` is null) and `files` beside. */
const withLedger = (text: string | null, files: Tree = {}, name = NAME): Tree => {
  const lib = library({ name, ledger: false, files: text === null ? files : { ...files, ".keel/ledger.json": text } });
  return project({ deps: [name], page: false, libraries: [lib] });
};

const messages = (hits: Rec[]): unknown[] => hits.map((h) => h.message);

// ---- clause 13 ----

test(
  "In that project, with no `.keel/ledger.json` in the library, `keel check` reports one E1162 at the `'@acme/charts'` entry, message `@acme/charts ships no .keel/ledger.json`",
  () => {
    const tree = withLedger(null);
    const hits = checkOf(tree);
    expect(hits.length).toBe(1);
    expect(hits[0]?.message).toBe("@acme/charts ships no .keel/ledger.json");
    expect(hits[0]?.path).toBe("modules/shop/module.ts");
    expect(hits[0]?.fix).toBeUndefined();
    expect(atEntryOf(tree, hits[0] ?? { kind: "diag" }, NAME)).toBe(true);
  },
  SLOW,
);

test(
  "In that project, `keel check` reports two E1162, one at each entry, when `modules/admin/module.ts` also lists `'@acme/charts'` in `deps`",
  () => {
    const tree: Tree = {
      ...withLedger(null),
      "modules/admin/module.ts": manifestSrc("admin").replace("deps: []", `deps: ['${NAME}']`),
    };
    const hits = checkOf(tree);
    expect(hits.map((h) => h.path).sort()).toEqual(["modules/admin/module.ts", "modules/shop/module.ts"]);
    for (const h of hits) {
      expect(h.message).toBe("@acme/charts ships no .keel/ledger.json");
      expect(atEntryOf(tree, h, NAME)).toBe(true);
    }
  },
  SLOW,
);

test(
  "In that project, an E1162 at each `deps` entry of a library manifest naming an installed library whose ledger file is missing",
  () => {
    const other = library({ name: "@acme/other", id: "other", ledger: false });
    const tree: Tree = {
      ...project({ page: false, libraries: [library({ deps: ["@acme/other"] }), other] }),
    };
    const hits = checkOf(tree);
    expect(hits.length).toBe(1);
    expect(hits[0]?.path).toBe(`${LIB}/module.ts`);
    expect(hits[0]?.message).toBe("@acme/other ships no .keel/ledger.json");
    expect(atEntryOf(tree, hits[0] ?? { kind: "diag" }, "@acme/other")).toBe(true);
  },
  SLOW,
);

test(
  "In that project, with `unsafe/u.ts` holding one `unsafe(...)` call and a ledger file whose `unsafe` is 0 and `hostElements` 2, two E1162 at the entry, messages `@acme/charts ships unsafe 0, its files hold 1` then `@acme/charts ships hostElements 2, its files hold 0`",
  () => {
    const tree = withLedger(shipped({ unsafe: 0, hostElements: 2 }), { "unsafe/u.ts": unsafeSrc(1) });
    const hits = checkOf(tree);
    expect(messages(hits)).toEqual([
      "@acme/charts ships unsafe 0, its files hold 1",
      "@acme/charts ships hostElements 2, its files hold 0",
    ]);
    for (const h of hits) {
      expect(h.path).toBe("modules/shop/module.ts");
      expect(h.fix).toBeUndefined();
      expect(atEntryOf(tree, h, NAME)).toBe(true);
    }
  },
  SLOW,
);

test(
  "In that project, with the linked library of the fourth bullet and no ledger file, `keel check` reports no E1162",
  () => {
    const dir = materialize(withLedger(null));
    const beside = linkBeside(dir);
    try {
      expect(diags(keel(dir, ["check"]), E1162)).toEqual([]);
    } finally {
      cleanup(dir);
      cleanup(beside);
    }
  },
  SLOW,
);

test(
  "E1162 for a name of 38 units and counts of six digits is each of its four messages whole: 65, 77 and 88 units, the counts message 82 of its 87, each within 89",
  () => {
    const name = "@acme-charts-widgets/chart-library-xyz";
    expect(name.length).toBe(38);
    const at = (text: string | null, files: Tree = {}): string[] =>
      checkOf(withLedger(text, files, name)).map((h) => String(h.message));
    const ships = at(null);
    expect(ships).toEqual([`${name} ships no .keel/ledger.json`]);
    expect(ships[0]?.length).toBe(65);
    const notObject = at("not json\n");
    expect(notObject).toEqual([`${name} .keel/ledger.json is not a JSON object`]);
    expect(notObject[0]?.length).toBe(77);
    const shape = at(shipped({ hostElements: -1 }));
    expect(shape).toEqual([`${name} .keel/ledger.json fails its shape at hostElements`]);
    expect(shape[0]?.length).toBe(88);
    const counts = at(shipped({ unsafe: 999999, hostElements: 999999 }));
    expect(counts).toEqual([
      `${name} ships unsafe 999999, its files hold 0`,
      `${name} ships hostElements 999999, its files hold 0`,
    ]);
    // 87 is the ceiling (both counts six digits); the counted value here is one digit, so 82 holds it whole.
    expect(counts[1]?.length).toBe(82);
    expect(counts[1]?.length).toBeLessThanOrEqual(87);
    for (const m of [...ships, ...notObject, ...shape, ...counts]) expect(m.length).toBeLessThanOrEqual(89);
  },
  SLOW,
);

test(
  "E1162 holds for every pair of shipped and recounted values: differing is one message per field, `unsafe` first; equal is none",
  () => {
    // seed 1337
    const n = fc.integer({ min: 0, max: 2 });
    fc.assert(
      fc.property(fc.tuple(n, n, fc.integer({ min: 0, max: 3 }), fc.integer({ min: 0, max: 3 })), ([u, h, su, sh]) => {
        const tree = withLedger(shipped({ unsafe: su, hostElements: sh }), {
          "unsafe/u.ts": unsafeSrc(u),
          ...hostFiles(h),
        });
        const want: string[] = [];
        if (su !== u) want.push(`${NAME} ships unsafe ${su}, its files hold ${u}`);
        if (sh !== h) want.push(`${NAME} ships hostElements ${sh}, its files hold ${h}`);
        const hits = checkOf(tree);
        expect(messages(hits)).toEqual(want);
        for (const x of hits) expect(atEntryOf(tree, x, NAME)).toBe(true);
      }),
      {
        seed: SEED,
        numRuns: 12,
        examples: [[[1, 1, 1, 1]], [[0, 0, 0, 0]], [[1, 0, 0, 0]], [[0, 2, 0, 1]]],
      },
    );
  },
  SLOW,
);

test(
  "a library lying with an `unsafe` count one lower than the truth is one E1162 `ships unsafe`, and one with a lower `hostElements` is one `ships hostElements`",
  () => {
    const u = checkOf(withLedger(shipped({ unsafe: 1 }), { "unsafe/u.ts": unsafeSrc(2) }));
    expect(messages(u)).toEqual([`${NAME} ships unsafe 1, its files hold 2`]);
    const h = checkOf(withLedger(shipped({ hostElements: 1 }), hostFiles(2)));
    expect(messages(h)).toEqual([`${NAME} ships hostElements 1, its files hold 2`]);
  },
  SLOW,
);

test(
  "a counted `unsafe(...)` in `src/` of the library is held in its count as one in `unsafe/` is, and a file outside `src/` and `unsafe/` is not",
  () => {
    const inSrc = checkOf(withLedger(shipped({ unsafe: 0 }), { "src/u.ts": unsafeSrc(1) }));
    expect(messages(inSrc)).toEqual([`${NAME} ships unsafe 0, its files hold 1`]);
    const outside = checkOf(withLedger(shipped({ unsafe: 0 }), { "scripts/u.ts": unsafeSrc(3) }));
    expect(outside).toEqual([]);
  },
  SLOW,
);

// ---- clause 14 ----

const reasons: ReadonlyArray<readonly [string, string, string]> = [
  ["not json", "not json", "is not a JSON object"],
  ["a missing `exports`", '{"version":1,"unsafe":0,"hostElements":0}', "fails its shape at exports"],
  [
    "a negative `hostElements`",
    '{"version":1,"unsafe":0,"hostElements":-1,"exports":[]}',
    "fails its shape at hostElements",
  ],
  [
    "a `rung` outside the six",
    '{"version":1,"unsafe":0,"hostElements":0,"exports":[{"pkg":"charts","name":"Badge","file":"src/Badge.tsx","rung":"tested"}]}',
    "fails its shape at exports",
  ],
];

for (const [what, text, tail] of reasons) {
  test(
    `In that project, a library \`.keel/ledger.json\` holding ${what} is one E1162 at the \`'@acme/charts'\` entry, message \`@acme/charts .keel/ledger.json \` followed by \`${tail}\``,
    () => {
      const tree = withLedger(text);
      const hits = checkOf(tree);
      expect(hits.length).toBe(1);
      expect(hits[0]?.message).toBe(`@acme/charts .keel/ledger.json ${tail}`);
      expect(hits[0]?.path).toBe("modules/shop/module.ts");
      expect(hits[0]?.fix).toBeUndefined();
      expect(atEntryOf(tree, hits[0] ?? { kind: "diag" }, NAME)).toBe(true);
    },
    SLOW,
  );
}

test(
  'In that project, a library `.keel/ledger.json` holding `{"version":1,"unsafe":0,"hostElements":0,"exports":[],"extra":true}` is no E1162',
  () => {
    expect(checkOf(withLedger('{"version":1,"unsafe":0,"hostElements":0,"exports":[],"extra":true}'))).toEqual([]);
  },
  SLOW,
);

test(
  "a library ledger file that is empty, or JSON of another type than an object, is one E1162 `is not a JSON object`",
  () => {
    for (const text of ["", "\n", "[]\n", "null\n", "1\n", '"x"\n', "true\n"]) {
      expect(messages(checkOf(withLedger(text)))).toEqual([`${NAME} .keel/ledger.json is not a JSON object`]);
    }
  },
  SLOW,
);

test(
  "a library ledger file missing a required key, or holding a wrong value, fails its shape at the first such top-level key in File's order",
  () => {
    const cases: ReadonlyArray<readonly [Record<string, unknown>, string]> = [
      [{ version: 2 }, "version"],
      [{ version: 0 }, "version"],
      [{ version: "1" }, "version"],
      [{ version: 1.5 }, "version"],
      [{ unsafe: "0" }, "unsafe"],
      [{ unsafe: 0.5 }, "unsafe"],
      [{ unsafe: null }, "unsafe"],
      [{ hostElements: 0.5 }, "hostElements"],
      [{ hostElements: "0" }, "hostElements"],
      [{ exports: {} }, "exports"],
      [{ exports: [{ pkg: "charts", name: "Badge", file: "src/Badge.tsx" }] }, "exports"],
      [{ exports: [{ pkg: "charts", name: 1, file: "src/Badge.tsx", rung: "example" }] }, "exports"],
      [{ version: 2, exports: 1 }, "version"],
      [{ unsafe: -0.5, hostElements: -1, exports: 1 }, "unsafe"],
      [{ hostElements: -1, exports: 1 }, "hostElements"],
    ];
    for (const [over, key] of cases) {
      expect(messages(checkOf(withLedger(shipped(over))))).toEqual([
        `${NAME} .keel/ledger.json fails its shape at ${key}`,
      ]);
    }
  },
  SLOW,
);

test(
  "a library ledger file without `version`, `unsafe` or `hostElements` fails its shape at that key",
  () => {
    for (const key of ["version", "unsafe", "hostElements", "exports"]) {
      const base: Record<string, unknown> = JSON.parse(shipped());
      delete base[key];
      expect(messages(checkOf(withLedger(`${JSON.stringify(base)}\n`)))).toEqual([
        `${NAME} .keel/ledger.json fails its shape at ${key}`,
      ]);
    }
  },
  SLOW,
);

test(
  "a `rung` outside the six names fails the shape at `exports`, and each of the six is read",
  () => {
    fc.assert(
      fc.property(
        fc.string({ maxLength: 12 }).filter((r) => !RUNGS.some((n) => n === r)),
        (rung) => {
          const hits = checkOf(withLedger(shipped({ exports: [badgeEntry(rung)] })));
          expect(messages(hits)).toEqual([`${NAME} .keel/ledger.json fails its shape at exports`]);
        },
      ),
      { seed: SEED, numRuns: 4, examples: [["tested"], [""], ["Example"]] },
    );
    for (const rung of RUNGS) expect(checkOf(withLedger(shipped({ exports: [badgeEntry(rung)] })))).toEqual([]);
  },
  SLOW,
);

test(
  "a library ledger file with keys other than File's, of any value, is no E1162",
  () => {
    const extra = shipped({
      extra: { a: 1 },
      unsafe2: 5,
      libraries: {},
      negativeTypes: 0,
      rungs: {},
      clauses: [],
      a11y: [],
    });
    expect(checkOf(withLedger(extra))).toEqual([]);
  },
  SLOW,
);

test(
  "a library ledger file that is empty, whitespace, not JSON, or JSON other than an object (an array, `null`, a number, a string, a boolean) is one E1162 `is not a JSON object`, for any such value",
  () => {
    // seed 1337
    const other = fc.oneof(
      fc.array(fc.integer(), { maxLength: 3 }),
      fc.integer(),
      fc.double({ noNaN: true, noDefaultInfinity: true }),
      fc.string({ maxLength: 8 }),
      fc.boolean(),
      fc.constant(null),
    );
    fc.assert(
      fc.property(other, (value) => {
        expect(messages(checkOf(withLedger(`${JSON.stringify(value)}\n`)))).toEqual([
          `${NAME} .keel/ledger.json is not a JSON object`,
        ]);
      }),
      { seed: SEED, numRuns: 5, examples: [[[]], [null], [0], [""], [false]] },
    );
    for (const text of ["", "   \n", "{", '{"version":1,', "undefined"]) {
      expect(messages(checkOf(withLedger(text)))).toEqual([`${NAME} .keel/ledger.json is not a JSON object`]);
    }
  },
  SLOW,
);

test(
  "an `exports` entry with a field missing or of another type is a wrong value: one E1162 failing its shape at `exports`",
  () => {
    // seed 1337
    const fields = ["pkg", "name", "file", "rung"] as const;
    const wrong = [1, null, true, [], {}, ["example"]];
    fc.assert(
      fc.property(fc.constantFrom(...fields), fc.constantFrom(...wrong, undefined), (field, value) => {
        const entry: Record<string, unknown> = { ...badgeEntry("example") };
        if (value === undefined) delete entry[field];
        else entry[field] = value;
        expect(messages(checkOf(withLedger(shipped({ exports: [entry] }))))).toEqual([
          `${NAME} .keel/ledger.json fails its shape at exports`,
        ]);
      }),
      {
        seed: SEED,
        numRuns: 6,
        examples: [
          ["pkg", undefined],
          ["rung", 1],
          ["file", null],
          ["name", []],
        ],
      },
    );
    // a good first entry does not hide a bad later one
    expect(messages(checkOf(withLedger(shipped({ exports: [badgeEntry("example"), { pkg: "charts" }] }))))).toEqual([
      `${NAME} .keel/ledger.json fails its shape at exports`,
    ]);
  },
  SLOW,
);

test(
  'a shipped file that lies about its numbers: `unsafe` "0", a float, `version` "1" fail the shape at that key; a negative integer, `1e2` and a number past six digits are integers whose count differs',
  () => {
    const raw = (unsafe: string, version = "1"): string =>
      `{"version":${version},"unsafe":${unsafe},"hostElements":0,"exports":[]}\n`;
    const at = (text: string): unknown[] => messages(checkOf(withLedger(text)));
    expect(at(raw('"0"'))).toEqual([`${NAME} .keel/ledger.json fails its shape at unsafe`]);
    expect(at(raw("0.5"))).toEqual([`${NAME} .keel/ledger.json fails its shape at unsafe`]);
    expect(at(raw("0", '"1"'))).toEqual([`${NAME} .keel/ledger.json fails its shape at version`]);
    expect(at(raw("-1"))).toEqual([`${NAME} ships unsafe -1, its files hold 0`]);
    expect(at(raw("1e2"))).toEqual([`${NAME} ships unsafe 100, its files hold 0`]);
    expect(at(raw("1234567"))).toEqual([`${NAME} ships unsafe 1234567, its files hold 0`]);
    // the number 1 written as 1.0 or 1e0 is the integer 1
    expect(at(raw("0", "1.0"))).toEqual([]);
    expect(at(raw("0", "1e0"))).toEqual([]);
  },
  SLOW,
);

test(
  "a library's shipped file is judged on `version`, `unsafe`, `hostElements` and `exports` alone: its other keys may be absent or hold anything",
  () => {
    const anything = shipped({
      negativeTypes: "x",
      rungs: 5,
      mutation: "m",
      clauses: 3,
      a11y: null,
      libraries: [1, "two"],
      extra: { deep: [1, { a: null }] },
    });
    expect(checkOf(withLedger(anything))).toEqual([]);
    expect(checkOf(withLedger(`${JSON.stringify({ version: 1, unsafe: 0, hostElements: 0, exports: [] })}\n`))).toEqual(
      [],
    );
  },
  SLOW,
);

test(
  "E1162 for a differing count: `unsafe` is at the entry's opening quote and `hostElements` a column after it, on one line, so `unsafe` sorts first",
  () => {
    const tree = withLedger(shipped({ unsafe: 0, hostElements: 2 }), { "unsafe/u.ts": unsafeSrc(1) });
    const hits = checkOf(tree);
    expect(messages(hits)).toEqual([
      `${NAME} ships unsafe 0, its files hold 1`,
      `${NAME} ships hostElements 2, its files hold 0`,
    ]);
    const src = tree["modules/shop/module.ts"] ?? "";
    const idx = src.indexOf(`'${NAME}'`);
    const line = src.slice(0, idx).split("\n").length;
    const col = idx - src.slice(0, idx).lastIndexOf("\n");
    expect(hits.map((h) => [h.line, h.col])).toEqual([
      [line, col],
      [line, col + 1],
    ]);
  },
  SLOW,
);

test(
  "E1162 comes from `keel check` alone: `keel ledger` takes a failing file (missing, not a JSON object or failing its shape) as none, with no E1162 and no library record",
  () => {
    const badges = [badgeEntry("example")];
    const failing: Array<[string | null, Tree]> = [
      [null, {}],
      ["not json\n", {}],
      [shipped({ version: 2, exports: badges }), {}],
    ];
    for (const [text, files] of failing) {
      const dir = materialize(withLedger(text, files));
      try {
        for (const args of [["ledger"], ["ledger", "--write", "out.json"]]) {
          const run = keel(dir, args);
          expect(diags(run, E1162)).toEqual([]);
          expect(ledgerRecs(run).filter((r) => String(r.item).startsWith("@acme/charts/"))).toEqual([]);
        }
      } finally {
        cleanup(dir);
      }
    }
  },
  SLOW,
);

test(
  "E1162 comes from `keel check` alone: `keel ledger` takes a file whose counts differ from the app's as none too, with no E1162 and no library record",
  () => {
    // k.library-pack Ledger file: "(`keel ledger` takes a failing file as none)"; k.library Ledger names only "A missing or misshapen file adds none".
    const dir = materialize(
      withLedger(shipped({ unsafe: 0, exports: [badgeEntry("example")] }), { "unsafe/u.ts": unsafeSrc(1) }),
    );
    try {
      const run = keel(dir, ["ledger"]);
      expect(diags(run, E1162)).toEqual([]);
      expect(ledgerRecs(run).filter((r) => String(r.item).startsWith("@acme/charts/"))).toEqual([]);
      // The library is still listed under `libraries`, with the app's recounted figures, never the file's.
      const out = writeLedger(dir);
      const libs =
        typeof out.json === "object" && out.json !== null && "libraries" in out.json ? out.json.libraries : null;
      expect(JSON.stringify(libs)).toBe(JSON.stringify({ [NAME]: { version: "1.0.0", unsafe: 1, hostElements: 0 } }));
      expect(ledgerRecs(out.run).filter((r) => String(r.item).startsWith("@acme/charts/"))).toEqual([]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

// ---- clause 15 ----

const U1 = { "unsafe/u.ts": unsafeSrc(1) };

/** The project of clause 15 and 16: the library's `unsafe` 1 (or `unsafeCalls`), its `exports` as given. */
const ledgerProject = (exports: unknown[], unsafeCalls = 1, extra: Tree = {}): Tree =>
  withLedger(shipped({ unsafe: unsafeCalls, exports }), { "unsafe/u.ts": unsafeSrc(unsafeCalls), ...extra });

test(
  "In that project, `keel ledger` emits `{ kind: 'ledger', item: '@acme/charts/src/Badge.tsx#Badge', rung: 'example', evidence: 'library 1.0.0' }` as its last `ledger` record",
  () => {
    const dir = materialize(ledgerProject([badgeEntry("example")]));
    try {
      const last = ledgerRecs(keel(dir, ["ledger"])).at(-1);
      expect(last).toMatchObject({
        kind: "ledger",
        item: "@acme/charts/src/Badge.tsx#Badge",
        rung: "example",
        evidence: "library 1.0.0",
      });
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "with that file's `exports` `[]` instead, `keel ledger` emits no record whose item starts with `@acme/charts/`, and the two runs give equal summary `counts`",
  () => {
    const a = materialize(ledgerProject([badgeEntry("example")]));
    const b = materialize(ledgerProject([]));
    try {
      const withEntry = keel(a, ["ledger"]);
      const without = keel(b, ["ledger"]);
      expect(
        ledgerRecs(without).filter((r) => typeof r.item === "string" && r.item.startsWith("@acme/charts/")),
      ).toEqual([]);
      expect(countsOf(withEntry)).toBeDefined();
      expect(countsOf(withEntry)).toEqual(countsOf(without));
    } finally {
      cleanup(a);
      cleanup(b);
    }
  },
  SLOW,
);

test(
  'with `--write .keel/ledger.json` the two runs write byte-equal files, whose `unsafe` is 1 and whose `libraries` is `{ "@acme/charts": { "version": "1.0.0", "unsafe": 1, "hostElements": 0 } }`',
  () => {
    const a = materialize(ledgerProject([badgeEntry("example")]));
    const b = materialize(ledgerProject([]));
    try {
      const x = writeLedger(a, ".keel/ledger.json");
      const y = writeLedger(b, ".keel/ledger.json");
      expect(x.text).not.toBe("");
      expect(x.text).toBe(y.text);
      expect(x.json).toMatchObject({ unsafe: 1 });
      const libs =
        typeof x.json === "object" && x.json !== null && "libraries" in x.json ? x.json.libraries : undefined;
      expect(JSON.stringify(libs)).toBe(
        JSON.stringify({ "@acme/charts": { version: "1.0.0", unsafe: 1, hostElements: 0 } }),
      );
      expect(x.json).not.toMatchObject({
        exports: expect.arrayContaining([expect.objectContaining({ pkg: "charts" })]),
      });
    } finally {
      cleanup(a);
      cleanup(b);
    }
  },
  SLOW,
);

test(
  "with `modules/shop/module.ts` listing no `'@acme/charts'`, `--write` writes `unsafe` 0 and `libraries` `{}`",
  () => {
    const dir = materialize(
      project({
        deps: [],
        page: false,
        libraries: [
          library({ files: { ...U1, ".keel/ledger.json": shipped({ unsafe: 1, exports: [badgeEntry("example")] }) } }),
        ],
      }),
    );
    try {
      const out = writeLedger(dir);
      expect(out.json).toMatchObject({ unsafe: 0, libraries: {} });
      expect(
        JSON.stringify(
          typeof out.json === "object" && out.json !== null && "libraries" in out.json ? out.json.libraries : null,
        ),
      ).toBe("{}");
      expect(
        ledgerRecs(out.run).filter((r) => typeof r.item === "string" && r.item.startsWith("@acme/charts/")),
      ).toEqual([]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "per entry of an installed library's ledger `exports`, libraries by name and entries in file order, `keel ledger` emits one record at the entry's rung, after the project's `ledger` records",
  () => {
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...RUNGS), { minLength: 1, maxLength: 4 }), (rungs) => {
        const names = ["Zed", "Mid", "Alpha", "Beta"];
        const entries = rungs.map((rung, i) => ({ ...badgeEntry(rung), name: names[i] ?? "X" }));
        const alpha = library({
          name: "@acme/alpha",
          id: "alpha",
          files: {
            ".keel/ledger.json": shipped({ exports: [{ pkg: "alpha", name: "A", file: "src/a.ts", rung: "proven" }] }),
          },
        });
        const charts = library({ files: { ".keel/ledger.json": shipped({ exports: entries }) } });
        const dir = materialize(project({ deps: [NAME, "@acme/alpha"], page: false, libraries: [charts, alpha] }));
        try {
          const recs = ledgerRecs(keel(dir, ["ledger"]));
          const items = recs.map((r) => String(r.item));
          const firstLib = items.findIndex((i) => i.startsWith("@acme/"));
          expect(items.slice(0, firstLib < 0 ? 0 : firstLib).some((i) => i.startsWith("@acme/"))).toBe(false);
          expect(items.slice(firstLib).every((i) => i.startsWith("@acme/"))).toBe(true);
          expect(items.slice(firstLib)).toEqual([
            "@acme/alpha/src/a.ts#A",
            ...entries.map((e) => `@acme/charts/src/Badge.tsx#${e.name}`),
          ]);
          const got = recs.slice(firstLib);
          expect(got.map((r) => r.rung)).toEqual(["proven", ...rungs]);
          expect(got.map((r) => r.evidence)).toEqual(["library 1.0.0", ...rungs.map(() => "library 1.0.0")]);
        } finally {
          cleanup(dir);
        }
      }),
      { seed: SEED, numRuns: 5 },
    );
  },
  SLOW,
);

test(
  "a missing library ledger file, or one failing its shape, adds no record to `keel ledger`",
  () => {
    const bad = [
      null,
      "not json\n",
      shipped({ version: 2, exports: [badgeEntry("example")] }),
      shipped({ exports: [badgeEntry("example"), { ...badgeEntry("example"), rung: "tested" }] }),
    ];
    for (const text of bad) {
      const dir = materialize(withLedger(text));
      try {
        const recs = ledgerRecs(keel(dir, ["ledger"]));
        expect(recs.filter((r) => typeof r.item === "string" && r.item.startsWith("@acme/charts/"))).toEqual([]);
      } finally {
        cleanup(dir);
      }
    }
  },
  SLOW,
);

test(
  "the written `exports` and `rungs` leave out a library's entries, whatever their rungs",
  () => {
    const dir = materialize(ledgerProject([badgeEntry("proven"), { ...badgeEntry("monitored"), name: "Other" }]));
    const empty = materialize(ledgerProject([]));
    try {
      const a = writeLedger(dir);
      const b = writeLedger(empty);
      expect(a.text).not.toBe("");
      expect(a.text).toBe(b.text);
    } finally {
      cleanup(dir);
      cleanup(empty);
    }
  },
  SLOW,
);

test(
  "the written file holds its keys in File's order, `libraries` last, as `JSON.stringify(value, null, 2)` and a line feed",
  () => {
    const order = [
      "version",
      "unsafe",
      "hostElements",
      "negativeTypes",
      "rungs",
      "mutation",
      "exports",
      "clauses",
      "a11y",
      "libraries",
    ];
    const dir = materialize(ledgerProject([badgeEntry("example")]));
    try {
      const out = writeLedger(dir);
      expect(typeof out.json).toBe("object");
      if (typeof out.json !== "object" || out.json === null) return;
      const keys = Object.keys(out.json);
      expect(keys.map((k) => order.indexOf(k))).toEqual(keys.map((k) => order.indexOf(k)).sort((p, q) => p - q));
      expect(keys.includes("version") && keys.every((k) => order.includes(k))).toBe(true);
      expect(keys.at(-1)).toBe("libraries");
      expect(keys.indexOf("hostElements")).toBe(keys.indexOf("unsafe") + 1);
      expect(out.text).toBe(`${JSON.stringify(out.json, null, 2)}\n`);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "`libraries` has an entry per library of the app, names in UTF-16 code-unit order whatever the order of `deps`, with its `version` and the app's counts, never its file's",
  () => {
    // seed 1337. Code-unit order: '-' (45) < '/' (47) < '1' (49) < 'a' (97), a prefix before what extends it;
    // a scope-then-base order would put "@acme-x/aa" after every "@acme/" name, and a digit-after-letter order "a1" after "ab".
    const sorted = ["@acme-x/aa", "@acme/a", "@acme/a-b", "@acme/a1", "@acme/ab", "@acme/zz"];
    fc.assert(
      fc.property(fc.shuffledSubarray(sorted, { minLength: sorted.length, maxLength: sorted.length }), (order) => {
        const libs = sorted.map((name, i) =>
          library({
            name,
            id: `m${i}`,
            files: {
              ".keel/ledger.json": shipped({ unsafe: 9, hostElements: 7 }),
              ...(i === 2 ? { "unsafe/u.ts": unsafeSrc(2), ...hostFiles(1) } : {}),
            },
          }),
        );
        const dir = materialize(project({ deps: order, page: false, libraries: libs }));
        try {
          const out = writeLedger(dir);
          const got =
            typeof out.json === "object" && out.json !== null && "libraries" in out.json ? out.json.libraries : null;
          expect(JSON.stringify(got)).toBe(
            JSON.stringify(
              Object.fromEntries(
                sorted.map((name, i) => [
                  name,
                  { version: "1.0.0", unsafe: i === 2 ? 2 : 0, hostElements: i === 2 ? 1 : 0 },
                ]),
              ),
            ),
          );
          expect(out.json).toMatchObject({ unsafe: 2, hostElements: 1 });
        } finally {
          cleanup(dir);
        }
      }),
      { seed: SEED, numRuns: 3, examples: [[[...sorted].reverse()]] },
    );
  },
  SLOW,
);

test(
  "`libraries` holds a library the app reaches through a library's manifest, and a linked library, whose counts are the app's",
  () => {
    const other = library({ name: "@acme/other", id: "other", files: { "unsafe/u.ts": unsafeSrc(1) } });
    const dir = materialize(project({ page: false, libraries: [library({ deps: ["@acme/other"] }), other] }));
    const beside = linkBeside(dir, "@acme/other");
    try {
      const out = writeLedger(dir);
      const libs =
        typeof out.json === "object" && out.json !== null && "libraries" in out.json ? out.json.libraries : null;
      expect(JSON.stringify(libs)).toBe(
        JSON.stringify({
          "@acme/charts": { version: "1.0.0", unsafe: 0, hostElements: 0 },
          "@acme/other": { version: "1.0.0", unsafe: 1, hostElements: 0 },
        }),
      );
    } finally {
      cleanup(dir);
      cleanup(beside);
    }
  },
  SLOW,
);

test(
  "`unsafe` and `hostElements` of the written file count a library's files, the sum over its `src/` and `unsafe/`",
  () => {
    const files = {
      "unsafe/u.ts": unsafeSrc(2),
      "src/v.ts": unsafeSrc(1),
      "scripts/w.ts": unsafeSrc(5),
      ...hostFiles(2),
    };
    const dir = materialize(withLedger(shipped({ unsafe: 3, hostElements: 2 }), files));
    try {
      const out = writeLedger(dir);
      expect(out.json).toMatchObject({
        unsafe: 3,
        hostElements: 2,
        libraries: { "@acme/charts": { version: "1.0.0", unsafe: 3, hostElements: 2 } },
      });
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "a library file the project's own read already counts (a library at `packages/<pkg>/`) is counted once, as the project's",
  () => {
    const dir = materialize(
      withLedger(shipped({ unsafe: 1, hostElements: 1 }), { "unsafe/u.ts": unsafeSrc(1), ...hostFiles(1) }),
    );
    linkInside(dir, "packages/charts");
    try {
      const out = writeLedger(dir);
      expect(out.json).toMatchObject({
        unsafe: 1,
        hostElements: 1,
        libraries: { "@acme/charts": { version: "1.0.0", unsafe: 1, hostElements: 1 } },
      });
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

const itemsOf = (run: Parameters<typeof ledgerRecs>[0]): string[] => ledgerRecs(run).map((r) => String(r.item));

test(
  "`--scope` keeps a library record whose item starts with it, as any item: `@acme/charts/` keeps one library's",
  () => {
    const alpha = library({
      name: "@acme/alpha",
      id: "alpha",
      files: {
        ".keel/ledger.json": shipped({ exports: [{ pkg: "alpha", name: "A", file: "src/a.ts", rung: "proven" }] }),
      },
    });
    const charts = library({ files: { ".keel/ledger.json": shipped({ exports: [badgeEntry("example")] }) } });
    const dir = materialize(project({ deps: [NAME, "@acme/alpha"], page: false, libraries: [charts, alpha] }));
    try {
      expect(itemsOf(keel(dir, ["ledger", "--scope", "@acme/charts/"]))).toEqual(["@acme/charts/src/Badge.tsx#Badge"]);
      expect(itemsOf(keel(dir, ["ledger", "--scope", "@acme/alpha/"]))).toEqual(["@acme/alpha/src/a.ts#A"]);
      expect(itemsOf(keel(dir, ["ledger", "--scope", "@acme/charts/src/Badge.tsx#B"]))).toEqual([
        "@acme/charts/src/Badge.tsx#Badge",
      ]);
      expect(itemsOf(keel(dir, ["ledger", "--scope", "@acme/charts/src/Other"]))).toEqual([]);
      const both = itemsOf(keel(dir, ["ledger", "--scope", "@acme/"]));
      expect(both).toEqual(["@acme/alpha/src/a.ts#A", "@acme/charts/src/Badge.tsx#Badge"]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

/** Moves the installed library of `dir` into a `node_modules` folder beside the project (a store layout) and links it back: its real path is in a `node_modules` folder, outside the project root. */
function linkStore(dir: string, name = NAME): string {
  const store = `${dir}-store`;
  const nm = join(store, "node_modules", ".pnpm", "c", "node_modules");
  const real = join(nm, ...name.split("/"));
  mkdirSync(dirname(real), { recursive: true });
  renameSync(join(dir, "node_modules", name), real);
  symlinkSync(real, join(dir, "node_modules", name));
  symlinkSync(join(dir, "node_modules", "@keel"), join(nm, "@keel"));
  return store;
}

const VERSIONED = (ledger: string): Tree => ({
  "package.json": JSON.stringify({
    name: NAME,
    version: "2.3.4",
    type: "module",
    keel: "library",
    exports: { ".": { keel: "./src/index.ts", default: "./index.js" } },
  }),
  ".keel/ledger.json": ledger,
});

test(
  "a library is installed when its real path is in a `node_modules` folder, else linked: `libraries` lists both with `version` from `package.json`, and only an installed library's `exports` give records",
  () => {
    const ledger = shipped({ exports: [badgeEntry("example")] });
    const mk = (): string => materialize(withLedger(null, VERSIONED(ledger)));
    const libsOf = (j: unknown): string =>
      JSON.stringify(typeof j === "object" && j !== null && "libraries" in j ? j.libraries : null);
    const want = JSON.stringify({ [NAME]: { version: "2.3.4", unsafe: 0, hostElements: 0 } });

    const installed = mk();
    const inStore = mk();
    const linked = mk();
    const stores = [linkStore(inStore)];
    stores.push(linkBeside(linked));
    try {
      for (const dir of [installed, inStore, linked]) expect(libsOf(writeLedger(dir).json)).toBe(want);
      const evidence = (dir: string): unknown[] =>
        ledgerRecs(keel(dir, ["ledger"])).filter((r) => String(r.item).startsWith("@acme/charts/"));
      const one = {
        kind: "ledger",
        item: "@acme/charts/src/Badge.tsx#Badge",
        rung: "example",
        evidence: "library 2.3.4",
      };
      expect(evidence(installed)).toMatchObject([one]);
      expect(evidence(inStore)).toMatchObject([one]);
      expect(evidence(linked)).toEqual([]);
    } finally {
      for (const d of [installed, inStore, linked, ...stores]) cleanup(d);
    }
  },
  SLOW,
);

test(
  "E1162 is read for an installed library whose real path is in a `node_modules` folder, and not for a linked one",
  () => {
    const inStore = materialize(withLedger(null));
    const linked = materialize(withLedger(null));
    const stores = [linkStore(inStore), linkBeside(linked)];
    try {
      expect(messages(diags(keel(inStore, ["check"]), E1162))).toEqual([`${NAME} ships no .keel/ledger.json`]);
      expect(diags(keel(linked, ["check"]), E1162)).toEqual([]);
    } finally {
      for (const d of [inStore, linked, ...stores]) cleanup(d);
    }
  },
  SLOW,
);

// ---- clause 16 ----

/** The project of clause 16 with the committed ledger written; returns its directory. */
function committed(): string {
  const dir = materialize(ledgerProject([badgeEntry("example")], 0));
  const out = writeLedger(dir, ".keel/ledger.json");
  expect(out.run.status).toBe(0);
  return dir;
}

test(
  "In that project, with `unsafe/u.ts` holding no `unsafe(...)` call and the library's `exports` holding the `Badge` entry at `example`, after `keel ledger --write .keel/ledger.json`, changing that entry's `rung` to `none` makes `keel ledger --diff` report no diagnostic",
  () => {
    const dir = committed();
    try {
      expect(keel(dir, ["ledger", "--diff"]).records.filter((r) => r.kind === "diag")).toEqual([]);
      writeFileSync(join(dir, LIB, ".keel/ledger.json"), shipped({ unsafe: 0, exports: [badgeEntry("none")] }));
      const diff = keel(dir, ["ledger", "--diff"]);
      expect(diff.status).toBe(0);
      expect(diff.records.filter((r) => r.kind === "diag")).toEqual([]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "adding one `unsafe(...)` call to `unsafe/u.ts` makes `keel ledger --diff` report one E1706, message `unsafe count up 0 -> 1`",
  () => {
    const dir = committed();
    try {
      writeFileSync(join(dir, LIB, "unsafe/u.ts"), unsafeSrc(1));
      const diff = keel(dir, ["ledger", "--diff"]);
      const hits = diags(diff, "E1706");
      expect(hits.length).toBe(1);
      expect(hits[0]?.message).toEqual(expect.stringContaining("unsafe count up 0 -> 1"));
      expect(diff.status).toBe(1);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "adding a library holding a `Host` element is E1706 under `--diff` until the ledger is written again",
  () => {
    const without = project({ deps: [], page: false, libraries: [library({ files: hostFiles(1) })] });
    const dir = materialize(without);
    try {
      expect(writeLedger(dir, ".keel/ledger.json").run.status).toBe(0);
      writeFileSync(join(dir, "modules/shop/module.ts"), manifestSrc("shop").replace("deps: []", `deps: ['${NAME}']`));
      expect(diags(keel(dir, ["ledger", "--diff"]), "E1706").length).toBe(1);
      expect(writeLedger(dir, ".keel/ledger.json").run.status).toBe(0);
      expect(diags(keel(dir, ["ledger", "--diff"]), "E1706")).toEqual([]);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "`--diff` leaves a library's `exports` entries out: a library entry at a lower rung than the committed ledger holds is no E1706",
  () => {
    const dir = committed();
    try {
      for (const rung of RUNGS) {
        writeFileSync(join(dir, LIB, ".keel/ledger.json"), shipped({ unsafe: 0, exports: [badgeEntry(rung)] }));
        expect(diags(keel(dir, ["ledger", "--diff"]), "E1706")).toEqual([]);
      }
      expect(existsSync(join(dir, ".keel/ledger.json"))).toBe(true);
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

// negativeTypes is another RFC's: only its place in the key order (above) is asserted. A library's own-folder ledger is slice 3's.

// ---- the byte bound, duplicate keys, the counts message at its bound ----

const BOUND = 262144;
const BOUND_MESSAGE = `${NAME} .keel/ledger.json is over ${BOUND} bytes`;
const bytes = (text: string): number => Buffer.byteLength(text, "utf8");

/** A valid ledger file of exactly `size` UTF-8 bytes whose padding key holds `fill` (one to four bytes a character) and ASCII for the rest. */
function padded(size: number, fill: string, over: Record<string, unknown> = {}): string {
  const head = (pad: string): string => shipped({ ...over, pad });
  const base = bytes(head(""));
  const room = size - base;
  const per = bytes(fill);
  const n = Math.floor(room / per);
  const text = head(fill.repeat(n) + "a".repeat(room - n * per));
  expect(bytes(text)).toBe(size);
  return text;
}

const FILLS: ReadonlyArray<readonly [string, string]> = [
  ["ASCII", "a"],
  ["two-byte characters", "\u00e9"],
  ["three-byte characters", "\u20ac"],
  ["four-byte characters", "\u{1F600}"],
];

for (const [what, fill] of FILLS) {
  test(
    `The app reads at most 262,144 UTF-8 bytes of an installed library's \`.keel/ledger.json\`: a file of exactly 262,144 bytes (${what}) is read, as a valid file is none`,
    () => {
      const text = padded(BOUND, fill);
      expect(bytes(text)).toBe(BOUND);
      expect(checkOf(withLedger(text))).toEqual([]);
    },
    SLOW,
  );

  test(
    `E1162 \`<name> .keel/ledger.json is over 262144 bytes\`: a file of 262,145 bytes (${what}) is one, whole`,
    () => {
      const text = padded(BOUND + 1, fill);
      expect(bytes(text)).toBe(BOUND + 1);
      const hits = checkOf(withLedger(text));
      expect(messages(hits)).toEqual([BOUND_MESSAGE]);
      expect(hits[0]?.fix).toBeUndefined();
      expect(hits[0]?.path).toBe("modules/shop/module.ts");
    },
    SLOW,
  );
}

test(
  "the bound counts bytes and not characters: a file of fewer than 262,144 characters and more than 262,144 bytes fails, and one of 262,144 characters in more bytes fails",
  () => {
    const fewer = padded(BOUND + 1, "\u20ac");
    expect([...fewer].length).toBeLessThan(BOUND);
    expect(messages(checkOf(withLedger(fewer)))).toEqual([BOUND_MESSAGE]);
    // Exactly 262,144 characters (one a two-byte character) is 262,145 bytes.
    const head = shipped({ pad: "" });
    const chars = head.length;
    const same = shipped({ pad: `\u00e9${"a".repeat(BOUND - chars - 1)}` });
    expect([...same].length).toBe(BOUND);
    expect(bytes(same)).toBe(BOUND + 1);
    expect(messages(checkOf(withLedger(same)))).toEqual([BOUND_MESSAGE]);
  },
  SLOW,
);

test(
  "E1162 over the bound is its message whole at a name of 38 units: 77 units, and the file read no further: no other message, whatever the text or counts past it",
  () => {
    const name = "@acme-charts-widgets/chart-library-xyz";
    expect(name.length).toBe(38);
    const message = `${name} .keel/ledger.json is over ${BOUND} bytes`;
    expect(message.length).toBe(77);
    for (const text of [
      padded(BOUND + 1, "a", { unsafe: 9, hostElements: 9 }),
      `${"x".repeat(BOUND + 1)}`,
      `${"{".repeat(BOUND + 1)}`,
    ]) {
      expect(messages(checkOf(withLedger(text, {}, name)))).toEqual([message]);
    }
  },
  SLOW,
);

test(
  "a file over the bound whose counts differ from the app's is the bound's message alone: the file is read no further, so no `ships` message",
  () => {
    const text = padded(BOUND + 100, "a", { unsafe: 5 });
    expect(messages(checkOf(withLedger(text, { "unsafe/u.ts": unsafeSrc(1) })))).toEqual([BOUND_MESSAGE]);
  },
  SLOW,
);

test(
  "`keel ledger` takes a file over the bound as none: its items are not shown, its counts recounted",
  () => {
    const text = padded(BOUND + 1, "a", { unsafe: 7, exports: [badgeEntry("example")] });
    const dir = materialize(withLedger(text, { "unsafe/u.ts": unsafeSrc(1) }));
    try {
      const run = keel(dir, ["ledger"]);
      expect(diags(run, E1162)).toEqual([]);
      expect(ledgerRecs(run).filter((r) => String(r.item).startsWith("@acme/charts/"))).toEqual([]);
      const out = writeLedger(dir);
      const libs =
        typeof out.json === "object" && out.json !== null && "libraries" in out.json ? out.json.libraries : null;
      expect(JSON.stringify(libs)).toBe(JSON.stringify({ [NAME]: { version: "1.0.0", unsafe: 1, hostElements: 0 } }));
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "a file of exactly 262,144 bytes is read by `keel ledger` as any file: its items are shown",
  () => {
    const text = padded(BOUND, "\u00e9", { exports: [badgeEntry("example")] });
    const dir = materialize(withLedger(text));
    try {
      const last = ledgerRecs(keel(dir, ["ledger"])).at(-1);
      expect(last).toMatchObject({
        item: "@acme/charts/src/Badge.tsx#Badge",
        rung: "example",
        evidence: "library 1.0.0",
      });
    } finally {
      cleanup(dir);
    }
  },
  SLOW,
);

test(
  "duplicate keys follow `JSON.parse`: the last wins: a file stating `unsafe` twice is judged on the last value, the true count first then a lower one is E1162, and the reverse is none",
  () => {
    const u2 = { "unsafe/u.ts": unsafeSrc(2) };
    const lyingLast = '{"version":1,"unsafe":2,"unsafe":1,"hostElements":0,"exports":[]}\n';
    expect(messages(checkOf(withLedger(lyingLast, u2)))).toEqual([`${NAME} ships unsafe 1, its files hold 2`]);
    const trueLast = '{"version":1,"unsafe":1,"unsafe":2,"hostElements":0,"exports":[]}\n';
    expect(checkOf(withLedger(trueLast, u2))).toEqual([]);
  },
  SLOW,
);

test(
  "duplicate keys: the last wins for `hostElements`, `version` and `exports` too, in the shape judgement as in the counts",
  () => {
    const h1 = hostFiles(1);
    expect(
      messages(checkOf(withLedger('{"version":1,"unsafe":0,"hostElements":1,"hostElements":0,"exports":[]}\n', h1))),
    ).toEqual([`${NAME} ships hostElements 0, its files hold 1`]);
    expect(
      checkOf(withLedger('{"version":1,"unsafe":0,"hostElements":0,"hostElements":1,"exports":[]}\n', h1)),
    ).toEqual([]);
    // A wrong first value is no fault when the last is right, and the reverse.
    expect(checkOf(withLedger('{"version":2,"version":1,"unsafe":0,"hostElements":0,"exports":[]}\n'))).toEqual([]);
    expect(
      messages(checkOf(withLedger('{"version":1,"version":2,"unsafe":0,"hostElements":0,"exports":[]}\n'))),
    ).toEqual([`${NAME} .keel/ledger.json fails its shape at version`]);
    expect(checkOf(withLedger('{"version":1,"unsafe":0,"hostElements":-1,"hostElements":0,"exports":[]}\n'))).toEqual(
      [],
    );
    expect(
      messages(checkOf(withLedger('{"version":1,"unsafe":0,"hostElements":0,"exports":[],"exports":5}\n'))),
    ).toEqual([`${NAME} .keel/ledger.json fails its shape at exports`]);
  },
  SLOW,
);

test(
  "duplicate keys: for any shipped values stated twice, the last of each is the one compared with the app's count",
  () => {
    // seed 1337
    const n = fc.integer({ min: 0, max: 2 });
    fc.assert(
      fc.property(fc.tuple(n, n, n), ([first, last, counted]) => {
        const text = `{"version":1,"unsafe":${first},"unsafe":${last},"hostElements":0,"exports":[]}\n`;
        const want = last === counted ? [] : [`${NAME} ships unsafe ${last}, its files hold ${counted}`];
        expect(messages(checkOf(withLedger(text, { "unsafe/u.ts": unsafeSrc(counted) })))).toEqual(want);
      }),
      { seed: SEED, numRuns: 8, examples: [[[2, 1, 2]], [[1, 2, 2]], [[0, 0, 1]]] },
    );
  },
  SLOW,
);

test("E1162 `<name> ships <field> <shipped>, its files hold <counted>` with a counted value of six digits is whole: `unsafe` 999999 shipped and 100000 counted, at a name of 38 units", () => {
  // The 87-unit form (`hostElements`, counted 100000) is untestable: 100,000 `Host` elements exhaust the checker's 4 GB heap; only the `unsafe` form (81 units) is asserted.
  const name = "@acme-charts-widgets/chart-library-xyz";
  expect(name.length).toBe(38);
  const hits = checkOf(withLedger(shipped({ unsafe: 999999 }), { "unsafe/u.ts": unsafeSrc(100000) }, name));
  expect(messages(hits)).toEqual([`${name} ships unsafe 999999, its files hold 100000`]);
  expect(String(hits[0]?.message).length).toBe(81);
}, 600_000);
