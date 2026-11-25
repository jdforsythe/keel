// Spec: k.library, the four clauses on the ledger over libraries, each quoted whole:
// 13. "In that project, with no `.keel/ledger.json` in the library, `keel check` reports one E1162 at the `'@acme/charts'` entry, message `@acme/charts ships no .keel/ledger.json`, and two, one at each entry, when `modules/admin/module.ts` also lists `'@acme/charts'` in `deps`; with `unsafe/u.ts` holding one `unsafe(...)` call and a ledger file whose `unsafe` is 0 and `hostElements` 2, two E1162 at the entry, messages `@acme/charts ships unsafe 0, its files hold 1` then `@acme/charts ships hostElements 2, its files hold 0`; with the linked library of the fourth bullet and no ledger file, none."
// 14. "In that project, a library `.keel/ledger.json` holding `not json`, `{\"version\":1,\"unsafe\":0,\"hostElements\":0}`, `{\"version\":1,\"unsafe\":0,\"hostElements\":-1,\"exports\":[]}` or `{\"version\":1,\"unsafe\":0,\"hostElements\":0,\"exports\":[{\"pkg\":\"charts\",\"name\":\"Badge\",\"file\":\"src/Badge.tsx\",\"rung\":\"tested\"}]}` is one E1162 at the `'@acme/charts'` entry, message `@acme/charts .keel/ledger.json ` followed by `is not a JSON object`, `fails its shape at exports`, `fails its shape at hostElements` and `fails its shape at exports` in turn; one holding `{\"version\":1,\"unsafe\":0,\"hostElements\":0,\"exports\":[],\"extra\":true}` is none."
// 15. "In that project, with `unsafe/u.ts` holding one `unsafe(...)` call and the library's `.keel/ledger.json` holding `unsafe` 1 and `exports` `[{ \"pkg\": \"charts\", \"name\": \"Badge\", \"file\": \"src/Badge.tsx\", \"rung\": \"example\" }]`, `keel ledger` emits `{ kind: 'ledger', item: '@acme/charts/src/Badge.tsx#Badge', rung: 'example', evidence: 'library 1.0.0' }` as its last `ledger` record; with that file's `exports` `[]` instead it emits no record whose item starts with `@acme/charts/`, and the two runs give equal summary `counts`, and with `--write .keel/ledger.json` byte-equal files, whose `unsafe` is 1 and whose `libraries` is `{ \"@acme/charts\": { \"version\": \"1.0.0\", \"unsafe\": 1, \"hostElements\": 0 } }`; with `modules/shop/module.ts` listing no `'@acme/charts'`, `--write` writes `unsafe` 0 and `libraries` `{}`."
// 16. "In that project, with `unsafe/u.ts` holding no `unsafe(...)` call and the library's `exports` holding the `Badge` entry at `example`, after `keel ledger --write .keel/ledger.json`, changing that entry's `rung` to `none` makes `keel ledger --diff` report no diagnostic, and adding one `unsafe(...)` call to `unsafe/u.ts` makes it report one E1706, message `unsafe count up 0 -> 1`."
// Rules: E1162 "an installed library's `.keel/ledger.json` missing (`<name> ships no .keel/ledger.json`), not a JSON object (`<name> .keel/ledger.json is not a JSON object`), failing k.ledger File's shape (`<name> .keel/ledger.json fails its shape at <key>`, the first top-level key, in File's order, missing where required or holding a wrong value), or else holding an `unsafe` or `hostElements` other than k.ledger's count over the library's files (`<name> ships <field> <shipped>, its files hold <counted>`, one per field, `unsafe` first), at each `deps` entry of an app or library manifest naming it (fix: none; whole at 89 units for a name of 38 and six-digit counts)."
// Ledger: "The app's `keel ledger` counts `unsafe` and `hostElements` over each library's files as over its own (k.host-element Ledger), so adding a library holding either is E1706 under `--diff` until the ledger is written again; a library whose real path is inside the project root is counted once, as the project's files. An installed library's real path lies inside a `node_modules` folder. Per entry of an installed library's ledger `exports` (libraries by name, entries in file order), `keel ledger` emits `{ kind: 'ledger', item: '<name>/<file>#<export>', rung, evidence: 'library <version>' }`, `<version>` its `package.json` `version`, after the project's `ledger` records; `--scope` filters them as other items. The app ran none of that evidence: the summary `counts`, the written `exports` and `rungs`, and `--diff` leave them out. A missing or misshapen file adds none. The written `libraries` has an entry per library of the app, installed or linked, names sorted: its `version` and the app's counts of its `unsafe` and `hostElements`, never its file's."
// k.ledger File: "`libraries` is `{ [name]: { version, unsafe, hostElements } }` (k.library Ledger), `{}` when there is none. Keys and orders are UTF-16 code-unit orders; a `rung` is one of the six Ledger names. A file read holds this shape when it is a JSON object whose `version`, `unsafe` and `hostElements` are integers, `hostElements` not negative, and whose `exports` is such an array; `negativeTypes`, `rungs`, `mutation`, `clauses`, `a11y` and `libraries` may be absent, ... other keys are ignored."
// "That project" is the first Conformance clause of k.library (library-support.ts builds it in a temporary project; `keel` runs as the real binary). Seed 1337.
// ASSUMPTIONS (spec silent, readings asserted):
//  - E1162 is read from `keel check`; `keel ledger` is asserted only for its records, counts and file.
//  - A JSON value that is not an object (`[]`, `null`, a number, a string) and an empty file are "not a JSON object".
//  - `exports` entries are `{ pkg, name, file, rung }`, all strings, `rung` one of the six names: a missing key or another type fails at `exports`.
//  - A library whose real path is inside the project root is built at `packages/charts` (its `src/` and `unsafe/` are files the project counts: k.host-element Ledger); the count is once.
//  - A linked library's `libraries` entry is written (the clause says "installed or linked"); a library in the files outside `src/` and `unsafe/` is not counted (k.library In an app).
//  - UNTESTABLE: "`--scope` filters them as other items": k.ledger does not state how `--scope` selects an item of the form `<name>/<file>#<export>`.
//  - UNTESTABLE: "whole at 89 units": the 89 is not derivable from the four messages for a name of 38 and six-digit counts; asserted are the four messages equal to their templates at that name and those counts.
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
  "E1162 for a name of 38 units and six-digit counts is each of its four messages, whole",
  () => {
    const name = "@acme-charts-widgets/chart-library-xyz";
    expect(name.length).toBe(38);
    const at = (text: string | null, files: Tree = {}): unknown[] => messages(checkOf(withLedger(text, files, name)));
    expect(at(null)).toEqual([`${name} ships no .keel/ledger.json`]);
    expect(at("not json\n")).toEqual([`${name} .keel/ledger.json is not a JSON object`]);
    expect(at(shipped({ exports: 1 }))).toEqual([`${name} .keel/ledger.json fails its shape at exports`]);
    expect(at(shipped({ unsafe: 999999, hostElements: 999999 }))).toEqual([
      `${name} ships unsafe 999999, its files hold 0`,
      `${name} ships hostElements 999999, its files hold 0`,
    ]);
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
  "`libraries` has an entry per library of the app, names in UTF-16 order, with its `version` and the app's counts, never its file's",
  () => {
    const upper = library({
      name: "@acme/Zeta",
      id: "zeta",
      files: { ".keel/ledger.json": shipped({ unsafe: 9, hostElements: 7 }) },
    });
    const lower = library({
      name: "@acme/alpha",
      id: "alpha",
      files: { "unsafe/u.ts": unsafeSrc(2), ...hostFiles(1) },
    });
    const charts = library({ files: { "unsafe/u.ts": unsafeSrc(0) } });
    const dir = materialize(
      project({ deps: ["@acme/alpha", NAME, "@acme/Zeta"], page: false, libraries: [lower, charts, upper] }),
    );
    try {
      const out = writeLedger(dir);
      const libs =
        typeof out.json === "object" && out.json !== null && "libraries" in out.json ? out.json.libraries : null;
      expect(JSON.stringify(libs)).toBe(
        JSON.stringify({
          "@acme/Zeta": { version: "1.0.0", unsafe: 0, hostElements: 0 },
          "@acme/alpha": { version: "1.0.0", unsafe: 2, hostElements: 1 },
          "@acme/charts": { version: "1.0.0", unsafe: 0, hostElements: 0 },
        }),
      );
      expect(out.json).toMatchObject({ unsafe: 2, hostElements: 1 });
    } finally {
      cleanup(dir);
    }
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
  "a library whose real path is inside the project root is counted once, as the project's files",
  () => {
    const dir = materialize(
      withLedger(shipped({ unsafe: 1, hostElements: 1 }), { "unsafe/u.ts": unsafeSrc(1), ...hostFiles(1) }),
    );
    linkInside(dir, "packages/charts");
    try {
      const out = writeLedger(dir);
      expect(out.json).toMatchObject({ unsafe: 1, hostElements: 1 });
    } finally {
      cleanup(dir);
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
