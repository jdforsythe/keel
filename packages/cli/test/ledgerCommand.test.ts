// ledgerCommand (k.ledger): the records, summary counts and ledger file of `keel ledger`, scoping by `--scope`, and the
// checks of `--diff` (E1706 lowered rungs and a risen unsafe count, E1712 an emptied rung, E1713 mutation scores and
// thresholds), called in process over in-memory projects. Seed 1337.
import { createHash } from "node:crypto";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import type { A11yCriteriaMap } from "../src/internal/A11yCriteriaMap.ts";
import { ledgerCommand } from "../src/internal/ledgerCommand.ts";
import type { Input } from "../src/types/Input.ts";
import type { OutRecord } from "../src/types/OutRecord.ts";
import type { SourceFile } from "../src/types/SourceFile.ts";

const CWD = "/work/app";
const file = (path: string, source: string): SourceFile => ({ path, source });
const sha = (text: string): string => createHash("sha256").update(text).digest("hex");
const FC = 'import fc from "fast-check";\n';
/** A test file whose one test body runs `body`. */
const spec = (path: string, body: string, head = ""): SourceFile =>
  file(path, `${head}import { it } from "vitest";\nit("t", () => {\n  ${body}\n});\n`);
const LEDGER = "tooling/ledger/ledger.json";
const call = (input: Input, files: SourceFile[], map?: A11yCriteriaMap) =>
  ledgerCommand(input, { cwd: CWD, files }, map);
const diags = (records: readonly OutRecord[]) => records.filter((r) => r.kind === "diag");
const of = (records: readonly OutRecord[], kind: string) => records.filter((r) => r.kind === kind);
const trailer = (records: readonly OutRecord[]) => records.at(-1);

const src = [
  file("packages/a/src/foo.ts", "export function foo() {}\n"),
  file("packages/a/src/bar.ts", "export const bar = () => unsafe('why', () => 1)\n"),
  file("packages/a/src/baz.ts", "export function baz() {}\n"),
  file("packages/b/src/qux.ts", "export function qux() {}\n"),
];
const base = [
  ...src,
  spec("packages/a/test/foo.test.ts", "foo(); fc.assert(p, { seed: 1337, numRuns: 100 });", FC),
  spec("packages/a/test/baz.test.ts", "baz();"),
];
const committed = (body: Record<string, unknown>, path = LEDGER): SourceFile =>
  file(path, JSON.stringify({ version: 1, unsafe: 1, hostElements: 0, exports: [], ...body }));

const MAP: A11yCriteriaMap = new Map([["1.1.1", { render: ["image-alt"], static: [] }]]);
const a11yFiles = (passed: boolean): SourceFile[] => [
  file("app/.keel/routes.json", JSON.stringify({ data: { "m.r": { module: "m" } }, hash: "x" })),
  file(
    "app/reports/a11y.json",
    JSON.stringify([
      { route: "m.r", component: null, rules: ["image-alt"], violations: [], file: "t", test: "t", passed },
    ]),
  ),
];
const report = (files: Record<string, string[]>, breakAt?: number): SourceFile =>
  file(
    "packages/a/reports/mutation/mutation.json",
    JSON.stringify({
      ...(breakAt === undefined ? {} : { thresholds: { break: breakAt } }),
      files: Object.fromEntries(
        Object.entries(files).map(([path, statuses]) => [
          path,
          { source: `src ${path}`, mutants: statuses.map((status) => ({ status })) },
        ]),
      ),
    }),
  );
const claimOf = (path: string, source: string, killed: number, survived: number) => ({
  file: path,
  sha: sha(source),
  killed,
  survived,
  noCoverage: 0,
  score: Number(((killed / (killed + survived)) * 100).toFixed(2)),
});

describe("ledgerCommand: the plain ledger", () => {
  test("ledgerCommand emits one ledger record per item, the strongest evidence first, then a summary with rung counts", () => {
    const out = call({}, base);
    expect(out.writes).toEqual([]);
    expect(out.records).toEqual([
      { kind: "ledger", item: "packages/a/src/bar.ts#bar", rung: "none", evidence: "none" },
      {
        kind: "ledger",
        item: "packages/a/src/baz.ts#baz",
        rung: "example",
        evidence: "example packages/a/test/baz.test.ts",
      },
      {
        kind: "ledger",
        item: "packages/a/src/foo.ts#foo",
        rung: "probabilistic",
        evidence: "property runs 100 seed 1337 packages/a/test/foo.test.ts",
      },
      { kind: "ledger", item: "packages/b/src/qux.ts#qux", rung: "none", evidence: "none" },
      {
        kind: "summary",
        ok: true,
        name: "ledger",
        counts: { items: 4, verified: 2, unsafe: 1, warnings: 0, example: 1, probabilistic: 1 },
      },
    ]);
  });

  test("the evidence line names the strongest piece, then +N for the others; the first of equals wins; a run outranks an example", () => {
    const files = [
      file("packages/a/src/foo.ts", "export function foo() {}\n"),
      spec("packages/a/test/a.test.ts", "foo();"),
      spec("packages/a/test/b.test.ts", "foo();"),
      spec("packages/a/test/c.test.ts", "foo(); fc.assert(p, { numRuns: 300 });", FC),
      spec("packages/a/test/d.test.ts", "foo(); fc.assert(p, { seed: 5, numRuns: 100 });", FC),
    ];
    const first = of(call({}, files).records, "ledger")[0];
    expect(first).toMatchObject({
      rung: "probabilistic",
      evidence: "property runs 100 seed 5 packages/a/test/d.test.ts +3",
    });
    const noSeed = of(
      call(
        {},
        files.filter((f) => !f.path.endsWith("d.test.ts")),
      ).records,
      "ledger",
    )[0];
    expect(noSeed).toMatchObject({ rung: "example", evidence: "property runs 300 packages/a/test/c.test.ts +2" });
    const twoExamples = of(call({}, files.slice(0, 3)).records, "ledger")[0];
    expect(twoExamples).toMatchObject({ evidence: "example packages/a/test/a.test.ts +1" });
  });

  test("a W1706 note comes before the records and is counted as a warning; it does not make the ledger fail", () => {
    const out = call({}, [...base, file("packages/a/conformance/c.test.ts", '// Clause: One.\nit("t", () => {});\n')]);
    expect(out.records[0]).toMatchObject({ kind: "diag", code: "W1706" });
    expect(trailer(out.records)).toMatchObject({ ok: true, counts: { warnings: 1 } });
  });

  test("--scope keeps the items whose key starts with it, and its summary counts only those", () => {
    const out = call({ scope: "packages/a/src/ba" }, base);
    expect(of(out.records, "ledger").map((r) => r.item)).toEqual([
      "packages/a/src/bar.ts#bar",
      "packages/a/src/baz.ts#baz",
    ]);
    expect(trailer(out.records)).toEqual({
      kind: "summary",
      ok: true,
      name: "ledger",
      counts: { items: 2, verified: 1, unsafe: 0, warnings: 0, example: 1 },
    });
    const none = call({ scope: "zzz" }, base);
    expect(none.records).toEqual([
      { kind: "summary", ok: true, name: "ledger", counts: { items: 0, verified: 0, unsafe: 0, warnings: 0 } },
    ]);
  });

  test("a scoped run drops the W1706 notes; the unsafe count is that of the apps the scope names", () => {
    const files = [
      ...base,
      file("apps/g/modules/x/add.ts", "export const add = () => 1\n"),
      file("apps/h/modules/y/sub.ts", "export const sub = () => unsafe('why', () => 1)\n"),
      file("apps/hh/modules/y/sub.ts", "export const sub = () => unsafe('a', () => unsafe('b', () => 1))\n"),
      file("packages/a/conformance/c.test.ts", '// Clause: One.\nit("t", () => {});\n'),
    ];
    const count = (scope: string) => {
      const t = trailer(call({ scope }, files).records);
      return t?.kind === "summary" ? t.counts : undefined;
    };
    expect(diags(call({ scope: "g:" }, files).records)).toEqual([]);
    expect(count("g:")).toMatchObject({ unsafe: 0, warnings: 0 });
    expect(count("h:")).toMatchObject({ unsafe: 1 });
    expect(count("hh:")).toMatchObject({ unsafe: 2 });
    expect(count("h")).toMatchObject({ unsafe: 3 });
    expect(count("h:y/")).toMatchObject({ unsafe: 1 });
    expect(count("hx")).toMatchObject({ unsafe: 0 });
    expect(count("packages/")).toMatchObject({ unsafe: 0 });
    expect(count("")).toMatchObject({ unsafe: 1, warnings: 1 });
  });

  test("--write puts the ledger file in writes and leaves the item records out of stdout; the file lists exports, clauses, rungs", () => {
    const withSpec = [...base, file("spec/kernel/k.a.md", "# k.a\n**Conformance.**\n- One works.\n")];
    const out = call({ write: "out/ledger.json" }, withSpec);
    expect(out.records).toEqual([
      {
        kind: "summary",
        ok: true,
        name: "ledger",
        counts: { items: 5, verified: 2, unsafe: 1, warnings: 0, example: 1, probabilistic: 1 },
      },
    ]);
    expect(out.writes).toHaveLength(1);
    const w = out.writes[0];
    expect(w).toMatchObject({ path: "out/ledger.json", readonly: false });
    const parsed: unknown = JSON.parse(w?.content ?? "");
    expect(parsed).toEqual({
      version: 1,
      unsafe: 1,
      hostElements: 0,
      rungs: { example: 1, probabilistic: 1, exhaustive: 0, proven: 0, monitored: 0 },
      exports: [
        { pkg: "a", name: "bar", file: "packages/a/src/bar.ts", rung: "none" },
        { pkg: "a", name: "baz", file: "packages/a/src/baz.ts", rung: "example" },
        { pkg: "a", name: "foo", file: "packages/a/src/foo.ts", rung: "probabilistic" },
        { pkg: "b", name: "qux", file: "packages/b/src/qux.ts", rung: "none" },
      ],
      clauses: [{ item: "k.a#1", rung: "none" }],
      a11y: [],
      libraries: {},
    });
    expect(w?.content?.endsWith("}\n")).toBe(true);
    expect(w?.content).toContain('\n  "version": 1,');
  });

  test("the file holds mutation only with a claim or a package threshold", () => {
    const none = call({ write: "l.json" }, base).writes[0]?.content ?? "";
    expect(JSON.parse(none)).not.toHaveProperty("mutation");
    const withClaim = call({ write: "l.json" }, [
      ...base,
      report({ "src/a.ts": ["Killed", "Survived"] }, 50),
      file("packages/a/src/a.ts", "src src/a.ts"),
    ]);
    expect(JSON.parse(withClaim.writes[0]?.content ?? "")).toMatchObject({
      mutation: { packages: { a: { threshold: 50 } } },
    });
    const onlyThreshold = call({ write: "l.json" }, [...base, report({ "src/a.ts": ["Ignored"] }, 50)]);
    expect(JSON.parse(onlyThreshold.writes[0]?.content ?? "")).toMatchObject({
      mutation: { packages: { a: { threshold: 50 } }, claims: [] },
    });
  });
});

describe("ledgerCommand: a11y claims", () => {
  test("each route and criterion is a ledger record after the items; a passing run that ran the rule is an example", () => {
    const files = [...src.slice(0, 1), ...a11yFiles(true)];
    const out = call({}, files, MAP);
    expect(of(out.records, "ledger")).toEqual([
      { kind: "ledger", item: "packages/a/src/foo.ts#foo", rung: "none", evidence: "none" },
      { kind: "ledger", item: "a11y:m.r#1.1.1", rung: "example", evidence: "example app/reports/a11y.json" },
    ]);
    expect(trailer(out.records)).toEqual({
      kind: "summary",
      ok: true,
      name: "ledger",
      counts: { items: 2, verified: 1, unsafe: 0, warnings: 0, example: 1 },
    });
  });

  test("a failing run, or no criteria map, gives no example claim; none is not verified", () => {
    const failing = call({}, a11yFiles(false), MAP);
    expect(of(failing.records, "ledger")).toEqual([
      { kind: "ledger", item: "a11y:m.r#1.1.1", rung: "none", evidence: "none" },
    ]);
    expect(trailer(failing.records)).toMatchObject({ counts: { items: 1, verified: 0 } });
    expect(of(call({}, a11yFiles(true)).records, "ledger")).toEqual([]);
    expect(of(call({}, a11yFiles(true), new Map()).records, "ledger")).toEqual([]);
  });

  test("--scope applies to claims by their a11y: key, and example counts follow the scope", () => {
    const files = [...base, ...a11yFiles(true)];
    const t = (scope: string) => {
      const x = trailer(call({ scope }, files, MAP).records);
      return x?.kind === "summary" ? x.counts : undefined;
    };
    expect(t("a11y:")).toEqual({ items: 1, verified: 1, unsafe: 0, warnings: 0, example: 1 });
    expect(t("a11y:m.r#1.1.1")).toEqual({ items: 1, verified: 1, unsafe: 0, warnings: 0, example: 1 });
    expect(t("a11y:other")).toEqual({ items: 0, verified: 0, unsafe: 0, warnings: 0 });
    expect(t("packages/a/src/baz")).toEqual({ items: 1, verified: 1, unsafe: 0, warnings: 0, example: 1 });
    expect(t("")).toEqual({ items: 5, verified: 3, unsafe: 1, warnings: 0, example: 2, probabilistic: 1 });
    expect(of(call({ scope: "packages/b/" }, files, MAP).records, "ledger").map((r) => r.item)).toEqual([
      "packages/b/src/qux.ts#qux",
    ]);
  });

  test("the ledger file lists the claims with their rungs", () => {
    const out = call({ write: "l.json" }, [...src.slice(0, 1), ...a11yFiles(true)], MAP);
    expect(JSON.parse(out.writes[0]?.content ?? "")).toMatchObject({
      a11y: [{ item: "a11y:m.r#1.1.1", rung: "example" }],
    });
  });
});

describe("ledgerCommand: mutation claims", () => {
  const files = [
    ...base,
    report({ "src/a.ts": ["Killed", "Timeout", "Survived", "NoCoverage"] }, 60),
    file("packages/a/src/a.ts", "src src/a.ts"),
  ];

  test("each claim is a ledger.mutation record after the items, with its score, survivors and freshness", () => {
    const out = call({}, files);
    expect(of(out.records, "ledger.mutation")).toEqual([
      { kind: "ledger.mutation", file: "packages/a/src/a.ts", score: 50, survived: 1, fresh: true },
    ]);
    expect(out.records.findIndex((r) => r.kind === "ledger.mutation")).toBeGreaterThan(
      out.records.map((r) => r.kind).lastIndexOf("ledger"),
    );
    const stale = call({}, [...files.slice(0, -1), file("packages/a/src/a.ts", "changed")]);
    expect(of(stale.records, "ledger.mutation")).toMatchObject([{ fresh: false }]);
  });

  test("a stale claim is W1714 at the file, counted as a warning and as stale; a scoped run lists none", () => {
    const stale = [...files.slice(0, -1), file("packages/a/src/a.ts", "changed")];
    const out = call({}, stale);
    expect(diags(out.records)).toEqual([
      {
        kind: "diag",
        code: "W1714",
        path: "packages/a/src/a.ts",
        line: 1,
        col: 1,
        message: "mutation claim stale: packages/a/src/a.ts changed since the run",
        see: "k.ledger",
      },
    ]);
    expect(trailer(out.records)).toMatchObject({ ok: true, counts: { warnings: 1, stale: 1 } });
    expect(trailer(call({}, files).records)).not.toHaveProperty("counts.stale");
    const scoped = call({ scope: "packages/a/" }, stale);
    expect(diags(scoped.records)).toEqual([]);
    expect(trailer(scoped.records)).toMatchObject({ counts: { warnings: 0 } });
  });

  test("--scope keeps the claims whose file starts with it", () => {
    expect(of(call({ scope: "packages/a/src/a" }, files).records, "ledger.mutation")).toHaveLength(1);
    expect(of(call({ scope: "packages/b/" }, files).records, "ledger.mutation")).toEqual([]);
    expect(of(call({ scope: "a.ts" }, files).records, "ledger.mutation")).toEqual([]);
  });

  test("--write leaves the mutation records out of stdout", () => {
    expect(of(call({ write: "l.json" }, files).records, "ledger.mutation")).toEqual([]);
  });
});

describe("ledgerCommand --diff", () => {
  test("it writes nothing and reports the counts with lowered and uncovered; no committed file compares with nothing", () => {
    const out = call({ diff: true, write: LEDGER }, [...base, committed({ exports: [] })]);
    expect(out.writes).toEqual([]);
    expect(out.records).toEqual([
      {
        kind: "summary",
        ok: true,
        name: "ledger --diff",
        counts: {
          items: 4,
          verified: 2,
          unsafe: 1,
          warnings: 0,
          example: 1,
          probabilistic: 1,
          lowered: 0,
          uncovered: 0,
        },
      },
    ]);
    const bare = call({ diff: true }, base);
    expect(bare.writes).toEqual([]);
    expect(diags(bare.records)).toEqual([]);
  });

  test("a committed file with no exports lists no before-items", () => {
    expect(
      diags(
        call({ diff: true }, [...base, file(LEDGER, JSON.stringify({ version: 1, unsafe: 1, hostElements: 0 }))])
          .records,
      ),
    ).toEqual([]);
  });

  test("a lowered rung is E1706 at the item's file, counted; --scope compares only items that start with it", () => {
    const old = committed({
      exports: [
        { pkg: "a", name: "foo", file: "packages/a/src/foo.ts", rung: "exhaustive" },
        { pkg: "b", name: "qux", file: "packages/b/src/qux.ts", rung: "example" },
      ],
    });
    const out = call({ diff: true }, [...base, old]);
    expect(diags(out.records)).toEqual([
      {
        kind: "diag",
        code: "E1706",
        path: "packages/a/src/foo.ts",
        line: 1,
        col: 1,
        message: "ledger rung lowered: packages/a/src/foo.ts#foo exhaustive -> probabilistic",
        see: "k.ledger",
      },
      {
        kind: "diag",
        code: "E1706",
        path: "packages/b/src/qux.ts",
        line: 1,
        col: 1,
        message: "ledger rung lowered: packages/b/src/qux.ts#qux example -> none",
        see: "k.ledger",
      },
    ]);
    expect(trailer(out.records)).toMatchObject({ ok: false, counts: { lowered: 2, uncovered: 0 } });
    const scoped = call({ diff: true, scope: "packages/a/" }, [...base, old]);
    expect(diags(scoped.records).map((d) => d.path)).toEqual(["packages/a/src/foo.ts"]);
    expect(call({ diff: true, scope: "packages/c/" }, [...base, old]).records.filter((r) => r.kind === "diag")).toEqual(
      [],
    );
    expect(diags(call({ diff: true, scope: "foo.ts" }, [...base, old]).records)).toEqual([]);
  });

  test("a lowered a11y claim is at reports/a11y.json, a lowered clause at its spec section", () => {
    const old = committed({
      unsafe: 0,
      a11y: [{ item: "a11y:m.r#1.1.1", rung: "example" }],
      clauses: [
        { item: "k.a#1", rung: "example" },
        { item: "std.s#1", rung: "example" },
      ],
    });
    const out = call(
      { diff: true },
      [
        old,
        ...a11yFiles(false),
        file("spec/kernel/k.a.md", "# k.a\n**Conformance.**\n- One works.\n"),
        file("spec/std/std.s.md", "# s\n**Conformance.**\n- One works.\n"),
      ],
      MAP,
    );
    expect(
      diags(out.records)
        .map((d) => d.path)
        .sort(),
    ).toEqual(["reports/a11y.json", "spec/kernel/k.a.md", "spec/std/std.s.md"]);
  });

  test("an unsafe count above the committed one is E1706 at the ledger file; scoped runs compare with zero", () => {
    const files = [
      ...base,
      file("apps/h/modules/y/sub.ts", "export const sub = () => unsafe('why', () => 1)\n"),
      file("apps/g/modules/x/add.ts", "export const add = () => 1\n"),
      file("packages/b/src/u.ts", "export const u = () => unsafe('why', () => 1)\n"),
    ];
    const up = call({ diff: true }, [...files, committed({ unsafe: 1 })]);
    expect(diags(up.records)).toEqual([
      { kind: "diag", code: "E1706", path: LEDGER, message: "unsafe count up 1 -> 2", see: "k.ledger" },
    ]);
    expect(diags(call({ diff: true }, [...files, committed({ unsafe: 2 })]).records)).toEqual([]);
    expect(diags(call({ diff: true }, [...files, committed({ unsafe: 5 })]).records)).toEqual([]);
    expect(diags(call({ diff: true, scope: "h:" }, [...files, committed({ unsafe: 9 })]).records)).toEqual([
      { kind: "diag", code: "E1706", path: LEDGER, message: "unsafe count up 0 -> 1", see: "k.ledger" },
    ]);
    expect(diags(call({ diff: true, scope: "g:" }, [...files, committed({ unsafe: 9 })]).records)).toEqual([]);
    expect(diags(call({ diff: true }, files).records)).toEqual([]);
  });

  test("host elements: counted in packages' src, apps and a root modules/ folder, by binding; E1706 on a rise without --scope", () => {
    const HOST = "import { Host as H } from '@keel/ui'\nimport * as ui from '@keel/ui'\n";
    const files = [
      ...base,
      file(
        "apps/h/modules/y/C.tsx",
        `${HOST}export const C = () => <div><H id="a" /><ui.Host id="b"></ui.Host></div>\n`,
      ),
      file("apps/g/modules/x/c.ts", `${HOST}export const c = () => H({ id: "c" })\n`),
      file("modules/r/D.tsx", `${HOST}export const D = () => <H id="d" />\n`),
      file("packages/b/src/e.ts", `${HOST}export const e = () => ui.Host({ id: "e" })\n`),
      file("packages/b/test/t.test.tsx", `${HOST}H({ id: "t" })\n`),
      file("lib/l.tsx", `${HOST}export const l = () => <H id="l" />\n`),
      file("apps/g/modules/x/o.tsx", "import { Host } from './Host.tsx'\nexport const o = () => <Host id=\"o\" />\n"),
    ];
    const count = (scope?: string) => {
      const t = trailer(call(scope === undefined ? {} : { scope }, files).records);
      return t?.kind === "summary" ? t.counts : undefined;
    };
    expect(count()).toMatchObject({ hostElements: 5 });
    expect(count("h:")).toMatchObject({ hostElements: 2 });
    expect(count("g:")).toMatchObject({ hostElements: 1 });
    expect(count("modules/r/")).toMatchObject({ hostElements: 1 });
    expect(count("packages/")).not.toHaveProperty("hostElements");
    const up = call({ diff: true }, [...files, committed({ hostElements: 4 })]);
    expect(diags(up.records)).toEqual([
      { kind: "diag", code: "E1706", path: LEDGER, message: "host elements up 4 -> 5", see: "k.host-element" },
    ]);
    expect(diags(call({ diff: true }, [...files, committed({ hostElements: 5 })]).records)).toEqual([]);
    expect(diags(call({ diff: true, scope: "h:" }, [...files, committed({ hostElements: 0 })]).records)).toEqual([]);
    const written = call({ write: LEDGER }, files).writes[0]?.content ?? "";
    expect(Object.keys(JSON.parse(written)).slice(0, 3)).toEqual(["version", "unsafe", "hostElements"]);
    expect(JSON.parse(written)).toMatchObject({ hostElements: 5 });
  });

  test("a rung the file counts above 0 that no item holds is E1712; counted-0 rungs and held ones are not; scoped runs skip it", () => {
    const old = committed({ rungs: { proven: 2, exhaustive: 0, example: 1, probabilistic: 3, monitored: 1 } });
    const out = call({ diff: true }, [...base, old]);
    expect(diags(out.records)).toEqual([
      {
        kind: "diag",
        code: "E1712",
        path: LEDGER,
        message: "rung proven is held by no item (committed 2)",
        see: "k.ledger",
      },
      {
        kind: "diag",
        code: "E1712",
        path: LEDGER,
        message: "rung monitored is held by no item (committed 1)",
        see: "k.ledger",
      },
    ]);
    expect(trailer(out.records)).toMatchObject({ ok: false, counts: { lowered: 2 } });
    expect(diags(call({ diff: true, scope: "packages/a/" }, [...base, old]).records)).toEqual([]);
    expect(diags(call({ diff: true }, [...base, committed({ rungs: {} })]).records)).toEqual([]);
  });

  test("an a11y example counts as holding the example rung", () => {
    const old = committed({ unsafe: 0, rungs: { example: 1 } });
    expect(diags(call({ diff: true }, [old, ...a11yFiles(true)], MAP).records)).toEqual([]);
    expect(diags(call({ diff: true }, [old, ...a11yFiles(false)], MAP).records).map((d) => d.code)).toEqual(["E1712"]);
  });
});

describe("ledgerCommand --diff: mutation (E1713)", () => {
  const at = "packages/a/reports/mutation/mutation.json";
  const srcA = file("packages/a/src/a.ts", "src src/a.ts");
  const withPkg = (score: number | undefined, threshold: number) =>
    committed({
      mutation: { packages: { a: score === undefined ? { threshold } : { score, threshold } }, claims: [] },
    });

  test("a fresh score below the package's threshold is E1713 at the report, naming both; equal passes", () => {
    const below = call({ diff: true }, [...base, srcA, report({ "src/a.ts": ["Killed", "Killed", "Survived"] }, 80)]);
    expect(diags(below.records)).toEqual([
      {
        kind: "diag",
        code: "E1713",
        path: at,
        message: "mutation a 66.67% is below its threshold 80%",
        see: "k.ledger",
      },
    ]);
    const equal = call({ diff: true }, [
      ...base,
      srcA,
      report({ "src/a.ts": [...Array(7).fill("Killed"), ...Array(3).fill("Survived")] }, 70),
    ]);
    expect(diags(equal.records)).toEqual([]);
    const above = call({ diff: true }, [...base, srcA, report({ "src/a.ts": ["Killed"] }, 99)]);
    expect(diags(above.records)).toEqual([]);
  });

  test("a package with a threshold, no claims and no score is not an error", () => {
    const out = call({ diff: true }, [...base, report({ "src/a.ts": ["Ignored"] }, 70)]);
    expect(diags(out.records)).toEqual([]);
  });

  test("a package whose every claim is stale is E1713 at the report when one is on disk, else at the ledger file", () => {
    const old = committed({
      mutation: {
        packages: { a: { score: 90, threshold: 70 } },
        claims: [claimOf("packages/a/src/a.ts", "old", 9, 1)],
      },
    });
    const out = call({ diff: true }, [...base, old, srcA]);
    expect(diags(out.records).map((d) => [d.code, d.path, d.message])).toEqual([
      ["W1714", "packages/a/src/a.ts", "mutation claim stale: packages/a/src/a.ts changed since the run"],
      ["E1713", LEDGER, "mutation a: every claim is stale, so no score meets 70%"],
    ]);
    const fresh = call({ diff: true }, [
      ...base,
      committed({
        mutation: {
          packages: { a: { score: 90, threshold: 70 } },
          claims: [claimOf("packages/a/src/a.ts", "src src/a.ts", 9, 1)],
        },
      }),
      srcA,
    ]);
    expect(diags(fresh.records)).toEqual([]);
    const other = call({ diff: true }, [
      ...base,
      committed({
        mutation: {
          packages: { z: { score: 90, threshold: 70 } },
          claims: [claimOf("packages/a/src/a.ts", "old", 9, 1)],
        },
      }),
      srcA,
    ]);
    expect(diags(other.records).map((d) => d.code)).toEqual(["W1714"]);
  });

  test("a threshold below the committed one is E1713; equal or higher is not", () => {
    const all = ["Killed", "Killed"];
    const lower = call({ diff: true }, [...base, srcA, report({ "src/a.ts": all }, 60), withPkg(100, 70)]);
    expect(diags(lower.records)).toEqual([
      {
        kind: "diag",
        code: "E1713",
        path: at,
        message: "mutation a threshold 60% is below the committed 70%",
        see: "k.ledger",
      },
    ]);
    for (const now of [70, 75])
      expect(
        diags(call({ diff: true }, [...base, srcA, report({ "src/a.ts": all }, now), withPkg(100, 70)]).records),
      ).toEqual([]);
    const noReport = call({ diff: true }, [...base, withPkg(undefined, 70)]);
    expect(diags(noReport.records)).toEqual([]);
  });

  test("a scoped diff fails only on errors inside its scope and counts the others in one I1713 line", () => {
    const low = [...base, srcA, report({ "src/a.ts": ["Killed", "Killed", "Survived"] }, 80)];
    const outside = call({ diff: true, scope: "golden:" }, low);
    expect(diags(outside.records).map((d) => [d.code, d.message])).toEqual([
      ["I1713", "1 mutation error outside the scope"],
    ]);
    expect(outside.records.at(-1)).toMatchObject({ kind: "summary", ok: true });
    const inside = call({ diff: true, scope: "packages/a/" }, low);
    expect(diags(inside.records).map((d) => d.code)).toEqual(["E1713"]);
    expect(inside.records.at(-1)).toMatchObject({ kind: "summary", ok: false });
    expect(diags(call({ diff: true }, low).records).map((d) => d.code)).toEqual(["E1713"]);
  });

  test("a package that was not committed has no threshold to fall below", () => {
    const out = call({ diff: true }, [
      ...base,
      srcA,
      report({ "src/a.ts": ["Killed"] }, 10),
      committed({ mutation: { packages: {}, claims: [] } }),
    ]);
    expect(diags(out.records)).toEqual([]);
  });

  test("both a low score and a lowered threshold are reported, in that order", () => {
    const out = call({ diff: true }, [
      ...base,
      srcA,
      report({ "src/a.ts": ["Killed", "Survived"] }, 60),
      withPkg(100, 70),
    ]);
    expect(diags(out.records).map((d) => d.message)).toEqual([
      "mutation a 50% is below its threshold 60%",
      "mutation a threshold 60% is below the committed 70%",
    ]);
  });

  test("property: a fresh score below its threshold is E1713 exactly when detected/(detected+undetected) is under it", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 0, max: 12 }),
        fc.integer({ min: 1, max: 100 }),
        (k, s, t) => {
          fc.pre(k + s > 0);
          const statuses = [...Array(k).fill("Killed"), ...Array(s).fill("Survived")];
          const out = call({ diff: true }, [srcA, report({ "src/a.ts": statuses }, t)]);
          const score = Number(((k / (k + s)) * 100).toFixed(2));
          expect(diags(out.records).length).toBe(score < t ? 1 : 0);
        },
      ),
      { seed: 1337, numRuns: 50 },
    );
  });
});
