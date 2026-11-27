import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { tempDir } from "@keel/tooling/test-tmp";
import { afterAll, describe, expect, it } from "vitest";
import { renderMarkdown } from "../evidence-markdown.mjs";
import {
  buildReport,
  checkedParts,
  countTestText,
  coveragePart,
  ledgerPart,
  mutationPart,
  notChecked,
  presentInputs,
  stableJson,
  testKind,
  testsPart,
} from "../evidence.mjs";

const root = tempDir("keel-evidence-");
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

const put = (rel: string, text: string) => {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
};

put("packages/a/package.json", "{}");
put("packages/a/src/x.ts", "export const x = 1;\n");
put(
  "packages/a/conformance/x.test.ts",
  [
    'it("one", () => {});',
    'test.skip("two", () => {});',
    'it.fails("three", () => {});',
    "fc.assert(fc.property(fc.nat(), () => true));",
  ].join("\n"),
);
put(
  "packages/a/test/y.test.ts",
  'it.each([1, 2])("each %i", () => {});\nawait properties(T, { runs: 100, seed: 1 });\n',
);
put("packages/a/node_modules/dep/z.test.ts", 'it("not counted", () => {});\n');
put("packages/b/package.json", "{}");
put("packages/b/src/b.ts", "export const b = 2;\n");
put("apps/app/package.json", "{}");
put("apps/app/modules/m/test/w.test.tsx", 'test("w", async () => { await simulate(async () => {}); });\n');
put("apps/app/loose.test.ts", 'it.todo("later");\nexplore([tx]);\n');
put("spec/kernel/k.one.md", "# k.one\nstatus: conformance-covered\n");
put("spec/std/std.two.md", "# std.two\nstatus: proposed\n");

const ledger = {
  unsafe: 2,
  rungs: { example: 3, probabilistic: 1, exhaustive: 0, proven: 1, monitored: 0 },
  clauses: [
    { item: "k.one#1", rung: "example" },
    { item: "k.one#2", rung: "probabilistic" },
    { item: "k.three#1", rung: "none" },
  ],
  exports: [
    { pkg: "a", name: "x", file: "packages/a/src/x.ts", rung: "proven" },
    { pkg: "b", name: "b", file: "packages/b/src/b.ts", rung: "none" },
  ],
  a11y: [{ item: "a11y:apps/a:m.r#1.1.1", rung: "example" }],
  mutation: {
    projects: { "packages/a": { score: 81.5, scoreJustified: 84, justified: 2, threshold: 70 } },
    claims: [
      { file: "packages/a/src/x.ts", sha: crypto.createHash("sha256").update("export const x = 1;\n").digest("hex") },
      { file: "packages/a/src/gone.ts", sha: "0" },
      { file: "packages/a/src/old.ts", sha: "0" },
    ],
  },
};
put("packages/a/src/old.ts", "changed\n");

describe("countTestText", () => {
  it("counts cases through modifiers, fails and skip/todo inside them", () => {
    const c = countTestText(
      'it("a", f);\ntest.only("b", f);\nit.skipIf(x)("c", f);\ntest.todo("d");\nit.concurrent.fails("e", f);\n',
    );
    expect(c).toMatchObject({ cases: 5, fails: 1, skipTodo: 2 });
  });
  it("ignores comments, strings, templates, declarations, members and unknown modifiers", () => {
    const src = [
      '// it("in a comment", f)',
      "/* test('block') */",
      "const s = 'it(\"in a string\")';",
      'const t = `test("in a template")`;',
      "function test(name) {}",
      "obj.it(1);",
      "const ext = test.extend({});",
      "describe('group', () => {});",
    ].join("\n");
    expect(countTestText(src)).toMatchObject({ cases: 0, propertyCalls: 0 });
  });
  it("counts property calls per call and flags simulate, explore and prove", () => {
    const c = countTestText(
      "fc.assert(p1);\nfc . assert(p2);\nawait properties(C, o);\nawait simulate(s);\nexplore([t]);\n",
    );
    expect(c).toMatchObject({ propertyCalls: 3, simulate: true, explore: true, prove: false });
  });
});

describe("testKind", () => {
  it("is conformance, then unit, then other by the directories on the path", () => {
    expect(testKind("conformance/x.test.ts")).toBe("conformance");
    expect(testKind("test/conformance/x.test.ts")).toBe("conformance");
    expect(testKind("modules/m/test/x.test.ts")).toBe("unit");
    expect(testKind("x.test.ts")).toBe("other");
    expect(testKind("src/test.test.ts")).toBe("other");
  });
});

describe("testsPart", () => {
  it("counts each unit with tests by kind and leaves units with none and node_modules out", () => {
    const t = testsPart(root);
    expect(Object.keys(t.packages)).toEqual(["apps/app", "packages/a"]);
    expect(t.packages["packages/a"]).toMatchObject({
      conformanceFiles: 1,
      conformanceCases: 3,
      unitFiles: 1,
      unitCases: 1,
      otherFiles: 0,
      propertyCalls: 2,
      fails: 1,
      skipTodo: 1,
    });
    expect(t.packages["apps/app"]).toMatchObject({
      unitFiles: 1,
      unitCases: 1,
      otherFiles: 1,
      otherCases: 1,
      simulateFiles: 1,
      exploreFiles: 1,
      skipTodo: 1,
    });
    expect(t.totals.conformanceCases + t.totals.unitCases + t.totals.otherCases).toBe(6);
  });
});

describe("ledgerPart", () => {
  it("groups clauses by section with every spec section listed, and tallies exports and WCAG items", () => {
    const l = ledgerPart(ledger, { "k.one": "conformance-covered", "std.two": "proposed" });
    expect(l).toMatchObject({ items: 6, verified: 4, unsafe: 2 });
    expect(l.clauses.sections["k.one"]).toMatchObject({ status: "conformance-covered", total: 2, verified: 2 });
    expect(l.clauses.sections["k.one"].byRung).toMatchObject({ example: 1, probabilistic: 1, none: 0 });
    expect(l.clauses.sections["std.two"]).toMatchObject({ status: "proposed", total: 0 });
    expect(l.clauses.sections["k.three"]).toMatchObject({ status: "unknown", total: 1, verified: 0 });
    expect(l.exports.byRung).toMatchObject({ proven: 1, none: 1 });
    expect(l.exports.packages.a).toMatchObject({ total: 1, verified: 1 });
    expect(l.a11y).toMatchObject({ total: 1, verified: 1 });
    expect(l.a11y.projects).toEqual({
      "apps/a": { byRung: expect.objectContaining({ example: 1 }), total: 1, verified: 1 },
    });
  });

  it("tallies WCAG items per project, `.` for the run's own directory", () => {
    const items = [
      { item: "a11y:.:m.r#1.1.1", rung: "example" },
      { item: "a11y:apps/a:m.r#1.1.1", rung: "none" },
      { item: "a11y:apps/a:m.s#1.4.3", rung: "example" },
    ];
    const l = ledgerPart({ ...ledger, a11y: items }, {});
    expect(Object.keys(l.a11y.projects).sort()).toEqual([".", "apps/a"]);
    expect(l.a11y.projects["apps/a"]).toMatchObject({ total: 2, verified: 1 });
    expect(l.a11y.projects["."]).toMatchObject({ total: 1, verified: 1 });
  });
});

describe("mutationPart", () => {
  it("counts a claim stale when its file differs, skips missing files, and gives a reason for unmutated units", () => {
    const m = mutationPart(root, ledger, ["packages/a", "packages/b"]);
    expect(m.packages["packages/a"]).toMatchObject({
      score: 81.5,
      scoreJustified: 84,
      justified: 2,
      threshold: 70,
      claims: 3,
      stale: 1,
      reason: null,
    });
    expect(m.packages["packages/b"]).toMatchObject({ score: null, reason: "no mutation run" });
    expect(m.stale).toBe(1);
  });
});

describe("coveragePart", () => {
  it("reads a summary and its meta, keeps a measured previous entry, and says 'not measured' otherwise", () => {
    const metric = { total: 10, covered: 9, skipped: 0, pct: 90 };
    put(
      "packages/a/coverage/coverage-summary.json",
      JSON.stringify({ total: { lines: metric, branches: metric, functions: metric, statements: metric } }),
    );
    put("packages/a/coverage/meta.json", JSON.stringify({ commit: "abc", dirty: false, measuredAt: "2026-01-01" }));
    const kept = { lines: metric, reason: null };
    const c = coveragePart(root, ["packages/a", "packages/b", "apps/app"], { "apps/app": kept });
    expect(c.packages["packages/a"]).toMatchObject({ lines: { pct: 90, total: 10, covered: 9 }, commit: "abc" });
    expect(c.packages["packages/b"]).toMatchObject({ lines: null, reason: "not measured" });
    expect(c.packages["apps/app"]).toBe(kept);
    fs.rmSync(path.join(root, "packages/a/coverage"), { recursive: true });
  });
});

describe("the report", () => {
  const at = (generatedAt: string) => buildReport({ root, ledger, commit: "c0ffee", generatedAt, previous: undefined });

  it("is the same text on the same tree but for the time, and --check's parts ignore the time", () => {
    const one = stableJson(at("2026-01-01T00:00:00.000Z"));
    const two = stableJson(at("2026-01-02T00:00:00.000Z"));
    const strip = (s: string) => s.replace(/"generatedAt": "[^"]*"/, "");
    expect(strip(one)).toBe(strip(two));
    expect(one).not.toBe(two);
    expect(checkedParts(at("a"))).toBe(checkedParts(at("b")));
  });
  it("changes its checked parts when a test is added", () => {
    const before = checkedParts(at("a"));
    put("packages/b/test/new.test.ts", 'it("new", () => {});\n');
    expect(checkedParts(at("a"))).not.toBe(before);
    fs.rmSync(path.join(root, "packages/b/test"), { recursive: true });
  });
  it("sorts keys at every depth", () => {
    expect(stableJson({ b: 1, a: { d: [{ z: 1, y: 2 }], c: null } })).toBe(
      '{\n  "a": {\n    "c": null,\n    "d": [\n      {\n        "y": 2,\n        "z": 1\n      }\n    ]\n  },\n  "b": 1\n}\n',
    );
  });
  it("renders markdown whose first line says it is generated and by which command", () => {
    const md = renderMarkdown(at("2026-01-01T00:00:00.000Z"));
    expect(md.split("\n")[0]).toContain("pnpm evidence:report --markdown");
    expect(md).toContain("| total (3 sections) |  | 3 | 2 | 1 | 1 | 1 | 0 | 0 | 0 |");
  });
  it("compares coverage and report dates only for units whose measurement files exist", () => {
    const units = ["packages/a", "packages/b"];
    const none = presentInputs(root, units);
    expect(none).toEqual({ coverage: [], mutationReports: [] });
    expect(notChecked(units, none)).toEqual({ coverage: 2, mutationReports: 2 });
    const base = at("a");
    const moved = {
      ...base,
      coverage: { packages: { "packages/a": { lines: { pct: 1 } } } },
      mutation: {
        ...base.mutation,
        packages: {
          ...base.mutation.packages,
          "packages/a": { ...base.mutation.packages["packages/a"], reportDate: "x" },
        },
      },
    };
    expect(checkedParts(moved, none)).toBe(checkedParts(base, none));
    const stale = { ...base, mutation: { ...base.mutation, stale: base.mutation.stale + 1 } };
    expect(checkedParts(stale, none)).not.toBe(checkedParts(base, none));
    put("packages/a/coverage/coverage-summary.json", "{}");
    put("packages/a/reports/mutation/mutation.json", "{}");
    const some = presentInputs(root, units);
    expect(some).toEqual({ coverage: ["packages/a"], mutationReports: ["packages/a"] });
    expect(notChecked(units, some)).toEqual({ coverage: 1, mutationReports: 1 });
    expect(checkedParts(moved, some)).not.toBe(checkedParts(base, some));
    fs.rmSync(path.join(root, "packages/a/coverage"), { recursive: true });
    fs.rmSync(path.join(root, "packages/a/reports"), { recursive: true });
  });
});
