// Exact-output tests for specCommand and specClauses (mutation killers).
import { describe, expect, it } from "vitest";
import { specClauses } from "../src/internal/specClauses.ts";
import { specCommand } from "../src/internal/specCommand.ts";

const CWD = "/work/app";
const f = (path: string, source: string) => ({ path, source });
const diag = (message: string) => ({ kind: "diag", code: "E1052", message, see: "k.cli" });

describe("specCommand", () => {
  const files = [
    f("spec/00-map.md", "# map\n"),
    f("spec/kernel/k.a.md", "# k.a\nE1 here\n  E1 indented  \nno\n"),
    f("spec/std/s.b.md", "# s.b\n"),
    f("spec/kernel/both.md", "# kernel both\n"),
    f("spec/std/both.md", "# std both\n"),
  ];

  it("no spec files: unavailable I1055 (other .md and non-spec paths do not count)", () => {
    const expected = [
      { kind: "diag", code: "I1055", message: "spec not available: needs spec/*.md in the project", see: "k.cli" },
      { kind: "summary", ok: true, name: "spec", counts: {} },
    ];
    expect(specCommand({}, { cwd: CWD })).toEqual(expected);
    expect(
      specCommand({}, { cwd: CWD, files: [f("docs/a.md", "x"), f("spec/a.txt", "x"), f("xspec/a.md", "x")] }),
    ).toEqual(expected);
    expect(specCommand({}, { cwd: CWD, files: [f("spec/a.md", "x")] })).not.toEqual(expected);
  });

  it("paths are taken relative to cwd", () => {
    const r = specCommand({ id: "k.a" }, { cwd: CWD, files: [f(`${CWD}/spec/kernel/k.a.md`, "hello")] });
    expect(r[0]).toEqual({ kind: "spec.section", id: "k.a", text: "hello" });
  });

  it("section: kernel first, then std; tokens = ceil(length / 4)", () => {
    expect(specCommand({ id: "k.a" }, { cwd: CWD, files })).toEqual([
      { kind: "spec.section", id: "k.a", text: "# k.a\nE1 here\n  E1 indented  \nno\n" },
      { kind: "summary", ok: true, name: "spec k.a", counts: { tokens: 9 } },
    ]);
    expect(specCommand({ id: "s.b" }, { cwd: CWD, files })[0]).toEqual({
      kind: "spec.section",
      id: "s.b",
      text: "# s.b\n",
    });
    expect(specCommand({ id: "both" }, { cwd: CWD, files })[0]).toEqual({
      kind: "spec.section",
      id: "both",
      text: "# kernel both\n",
    });
    const four = specCommand({ id: "x" }, { cwd: CWD, files: [f("spec/kernel/x.md", "abcd")] });
    expect(four[1]).toEqual({ kind: "summary", ok: true, name: "spec x", counts: { tokens: 1 } });
    const five = specCommand({ id: "x" }, { cwd: CWD, files: [f("spec/kernel/x.md", "abcde")] });
    expect(five[1]).toEqual({ kind: "summary", ok: true, name: "spec x", counts: { tokens: 2 } });
  });

  it("map: no id, --map, or id `map`", () => {
    const map = [
      { kind: "spec.section", id: "map", text: "# map\n" },
      { kind: "summary", ok: true, name: "spec map", counts: { tokens: 2 } },
    ];
    expect(specCommand({}, { cwd: CWD, files })).toEqual(map);
    expect(specCommand({ map: true }, { cwd: CWD, files })).toEqual(map);
    expect(specCommand({ map: false }, { cwd: CWD, files })).toEqual(map);
    expect(specCommand({ id: "map" }, { cwd: CWD, files })).toEqual(map);
  });

  it("map false does not conflict with an id", () => {
    expect(specCommand({ id: "k.a", map: false }, { cwd: CWD, files })[0]).toMatchObject({ kind: "spec.section" });
  });

  it("unknown id: E1052, id clipped at 24, summary fails", () => {
    const d = diag('no spec section "k.nope"; see keel spec --map');
    expect(specCommand({ id: "k.nope" }, { cwd: CWD, files })).toEqual([
      d,
      { kind: "summary", ok: false, name: "spec", counts: {} },
    ]);
    const long = specCommand({ id: "n".repeat(40) }, { cwd: CWD, files });
    expect(long[0]).toEqual(diag(`no spec section "${"n".repeat(24)}"; see keel spec --map`));
    expect(specCommand({ id: "x" }, { cwd: CWD, files: [f("spec/00-map.md", "m")] })[0]).toMatchObject({
      code: "E1052",
    });
  });

  it("no map file: E1052 for map", () => {
    expect(specCommand({}, { cwd: CWD, files: [f("spec/kernel/a.md", "x")] })[0]).toEqual(
      diag('no spec section "map"; see keel spec --map'),
    );
  });

  it("more than one of <id>, --for, --map is E1052", () => {
    const d = diag("give one of <id>, --for <code>, --map");
    const fail = [d, { kind: "summary", ok: false, name: "spec", counts: {} }];
    expect(specCommand({ id: "k.a", map: true }, { cwd: CWD, files })).toEqual(fail);
    expect(specCommand({ id: "k.a", for: "E1" }, { cwd: CWD, files })).toEqual(fail);
    expect(specCommand({ for: "E1", map: true }, { cwd: CWD, files })).toEqual(fail);
    expect(specCommand({ id: "k.a", for: "E1", map: true }, { cwd: CWD, files })).toEqual(fail);
  });

  it("--for lists every citing line with trimmed, clipped text", () => {
    expect(specCommand({ for: "E1" }, { cwd: CWD, files })).toEqual([
      { kind: "spec.cite", code: "E1", path: "spec/kernel/k.a.md", line: 2, text: "E1 here" },
      { kind: "spec.cite", code: "E1", path: "spec/kernel/k.a.md", line: 3, text: "E1 indented" },
      { kind: "summary", ok: true, name: "spec --for E1", counts: { lines: 2 } },
    ]);
    expect(specCommand({ for: "ZZZ" }, { cwd: CWD, files })).toEqual([
      { kind: "summary", ok: true, name: "spec --for ZZZ", counts: { lines: 0 } },
    ]);
    const long = specCommand({ for: "E1" }, { cwd: CWD, files: [f("spec/kernel/l.md", `E1${"x".repeat(200)}`)] });
    expect(long[0]).toMatchObject({ text: `E1${"x".repeat(158)}` });
    const exact = specCommand({ for: "E1" }, { cwd: CWD, files: [f("spec/kernel/l.md", `E1${"x".repeat(158)}`)] });
    expect(exact[0]).toMatchObject({ text: `E1${"x".repeat(158)}` });
  });

  it("--for is ordered by path across files", () => {
    const r = specCommand(
      { for: "E9" },
      { cwd: CWD, files: [f("spec/std/b.md", "E9"), f("spec/kernel/a.md", "x\nE9")] },
    );
    expect(r.map((x) => x.path)).toEqual(["spec/kernel/a.md", "spec/std/b.md", undefined]);
    expect(r[0]).toMatchObject({ line: 2 });
    expect(r[1]).toMatchObject({ line: 1 });
  });

  it("an empty --for code is still a request for citations (matches every line)", () => {
    const r = specCommand({ for: "" }, { cwd: CWD, files: [f("spec/kernel/a.md", "x\ny")] });
    expect(r).toHaveLength(3);
  });
});

describe("specClauses", () => {
  const sec = (...body: string[]): string => ["# t", "intro", ...body].join("\n");

  it("reads the Conformance list: numbered from 1, text trimmed after the dash", () => {
    const src = sec("**Conformance.**", "- first  ", "- second", "", "- after blank");
    expect(specClauses([f("spec/kernel/k.x.md", src)])).toEqual([
      { id: "k.x", n: 1, text: "first", line: 4 },
      { id: "k.x", n: 2, text: "second", line: 5 },
    ]);
  });

  it("stops at a bold line; skips non-list lines inside; whitespace-only line ends it", () => {
    expect(
      specClauses([f("spec/std/s.md", sec("**Conformance.**", "- a", "prose", "-b", "- c", "**Next.**", "- d"))]),
    ).toEqual([
      { id: "s", n: 1, text: "a", line: 4 },
      { id: "s", n: 2, text: "c", line: 7 },
    ]);
    expect(specClauses([f("spec/std/s.md", sec("**Conformance.**", "- a", "   ", "- b"))])).toEqual([
      { id: "s", n: 1, text: "a", line: 4 },
    ]);
  });

  it("ignores list items before the heading and non-matching paths; continues with later files", () => {
    const good = f("spec/kernel/ok.md", sec("- before", "**Conformance.**", "- yes"));
    const files = [
      f("spec/kernel/none.md", sec("- x")),
      f("spec/other/o.md", sec("**Conformance.**", "- o")),
      f("spec/kernel/a/b.md", sec("**Conformance.**", "- nested")),
      f("xspec/kernel/x.md", sec("**Conformance.**", "- x")),
      f("spec/kernel/x.mdx", sec("**Conformance.**", "- x")),
      f("spec/kernel/.md", sec("**Conformance.**", "- empty id")),
      f("spec/kernel/ind.md", sec(" **Conformance.**", "- indented")),
      good,
    ];
    expect(specClauses(files)).toEqual([{ id: "ok", n: 1, text: "yes", line: 5 }]);
  });

  it("only the first Conformance heading counts; counters restart per file", () => {
    const a = f("spec/kernel/a.md", sec("**Conformance.**", "- 1", "**Conformance.**", "- 2"));
    const b = f("spec/std/b.md", sec("**Conformance.**", "- 3"));
    expect(specClauses([a, b])).toEqual([
      { id: "a", n: 1, text: "1", line: 4 },
      { id: "b", n: 1, text: "3", line: 4 },
    ]);
  });

  it("heading at the very end yields nothing", () => {
    expect(specClauses([f("spec/kernel/e.md", "**Conformance.**")])).toEqual([]);
    expect(specClauses([])).toEqual([]);
  });
});
