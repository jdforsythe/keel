// Mutation-killing tests for the ledger: item discovery (buildLedger) and its rendering/diff (ledgerCommand).
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { buildLedger } from "../src/internal/buildLedger.ts";

const CWD = "/work/app";
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");
const file = (path: string, source: string) => ({ path, source });
const EX = { kind: "example", passed: true };
const prop = (runs: number, seed?: number) => ({
  kind: "property",
  passed: true,
  runs,
  ...(seed === undefined ? {} : { seed }),
});

describe("buildLedger", () => {
  it("lists exported functions sorted by path, with evidence from the same package's tests only", () => {
    const { items, unsafe } = buildLedger([
      file("packages/a/src/zeta.ts", "export function zeta() {}\n"),
      file("packages/a/src/mid.ts", "export const mid = async () => 1\n"),
      file("packages/a/src/alpha.ts", "export async function* alpha() {}\n"),
      file("packages/a/src/arrow.ts", "export const arrow = x => x\n"),
      file("packages/a/src/ty.ts", "export const ty: Fn = function () {}\n"),
      file("packages/a/src/val.ts", "export const val = 5\n"),
      file("packages/a/src/view.tsx", "export function view() {}\n"),
      file("packages/a/src/internal/deep.ts", "export function deep() {}\n"),
      file("packages/a/lib/other.ts", "export function other() {}\n"),
      file("packages/a/unsafe/u.ts", "export function inUnsafe() {}\n"),
      file("packages/a/test/z.test.ts", "zeta()\nalpha\n"),
      file("packages/a/test/notes.md", "zeta alpha mid\n"),
      file("packages/b/test/z.test.ts", "zeta()\n"),
    ]);
    expect(items.map((i) => i.item)).toEqual([
      "packages/a/src/alpha.ts#alpha",
      "packages/a/src/arrow.ts#arrow",
      "packages/a/src/mid.ts#mid",
      "packages/a/src/ty.ts#ty",
      "packages/a/src/zeta.ts#zeta",
    ]);
    const ev = (name: string) => items.find((i) => i.item.endsWith(`#${name}`))?.evidence;
    expect(ev("zeta")).toEqual([{ ev: EX, path: "packages/a/test/z.test.ts" }]);
    expect(ev("alpha")).toEqual([{ ev: EX, path: "packages/a/test/z.test.ts" }]);
    expect(ev("mid")).toEqual([]);
    expect(unsafe).toBe(0);
  });

  it("matches the exported name as a whole word, including names with $", () => {
    const { items } = buildLedger([
      file("packages/a/src/foo.ts", "export function foo() {}\n"),
      file("packages/a/src/x$.ts", "export function x$() {}\n"),
      file("packages/a/test/t.test.ts", "foobar()"),
      file("packages/a/test/u.test.ts", "x"),
    ]);
    expect(items.find((i) => i.item.endsWith("#foo"))?.evidence).toEqual([]);
    expect(items.find((i) => i.item.endsWith("#x$"))?.evidence).toEqual([]);
  });

  it("counts unsafe( calls in src and unsafe dirs only, outside comments, strings and declarations", () => {
    const { unsafe } = buildLedger([
      file(
        "packages/a/src/one.ts",
        [
          "export const one = () => unsafe('why', () => 1)",
          "// unsafe(commented)",
          "const s = 'unsafe(in string)'",
          "export function unsafe(x: string) {}",
          "const two = unsafe ( 'a' ) + unsafe('b')",
        ].join("\n"),
      ),
      file("packages/a/unsafe/u.ts", "unsafe('x')\n"),
      file("packages/a/lib/l.ts", "unsafe('x')\n"),
      file("packages/a/test/t.test.ts", "unsafe('x')\n"),
      file("packages/a/src/notes.md", "unsafe('x')\n"),
    ]);
    expect(unsafe).toBe(4);
  });

  it("a property file is evidence with its runs and seed; the strongest is the largest literal numRuns", () => {
    const { items } = buildLedger([
      file("packages/a/src/foo.ts", "export function foo() {}\n"),
      file(
        "packages/a/test/p.test.ts",
        "import fc from 'fast-check'\nfoo()\n{ seed: 7, numRuns: 50 }\n{ numRuns: 300 }\n",
      ),
      file("packages/a/conformance/c.test.ts", "foo()\n"),
    ]);
    expect(items[0]?.evidence).toEqual([
      { ev: prop(300, 7), path: "packages/a/test/p.test.ts" },
      { ev: EX, path: "packages/a/conformance/c.test.ts" },
    ]);
  });

  it("spec clauses take evidence from conformance files whose leading // Spec: lines name the section and clause", () => {
    const spec = file(
      "spec/kernel/k.a.b.md",
      "# k.a.b\n\n**Conformance.**\n- One works.\n- Two works.\n\n**Other.**\n- Not a clause.\n",
    );
    const { items } = buildLedger([
      spec,
      file("spec/std/s.c.md", "# s\n**Conformance.**\n- Std clause.\n"),
      file("spec/kernel/none.md", "# no conformance\n- x\n"),
      file("packages/a/conformance/yes.test.ts", '// Spec: k.a.b, clause "One works."\nimport fc from "fast-check"\n'),
      file("packages/a/conformance/lookalike.test.ts", '// Spec: k.aXb, clause "One works."\n'),
      file("packages/a/conformance/longer.test.ts", '// Spec: k.a.bc, clause "One works."\n'),
      file("packages/a/conformance/late.test.ts", 'const x = 1\n// Spec: k.a.b, clause "One works."\n'),
      file("packages/a/conformance/split.test.ts", '// Spec: k.a.b\n// clause "One works."\n'),
      file("packages/a/conformance/two.test.ts", '// header\n// Spec: k.a.b, clause "Two works."\nfoo\n'),
      file("packages/a/test/notconf.test.ts", '// Spec: k.a.b, clause "One works."\n'),
      file("packages/a/conformance/std.test.ts", '// Spec: s.c, clause "Std clause."\n'),
    ]);
    expect(items).toEqual([
      { item: "k.a.b#1", evidence: [{ ev: prop(100), path: "packages/a/conformance/yes.test.ts" }] },
      { item: "k.a.b#2", evidence: [{ ev: EX, path: "packages/a/conformance/two.test.ts" }] },
      { item: "s.c#1", evidence: [{ ev: EX, path: "packages/a/conformance/std.test.ts" }] },
    ]);
  });
});

const base = [
  file("packages/a/src/foo.ts", "export function foo() {}\n"),
  file("packages/a/src/bar.ts", "export const bar = () => unsafe('why', () => 1)\n"),
  file("packages/a/src/baz.ts", "export function baz() {}\n"),
  file("packages/a/test/foo.test.ts", "import fc from 'fast-check'\nfoo()\n{ seed: 1337, numRuns: 100 }\n"),
  file("packages/a/test/foo2.test.ts", "foo()\n"),
  file("packages/a/test/foo3.test.ts", "foo()\n"),
  file("packages/a/test/baz.test.ts", "baz()\n"),
  file("packages/a/test/baz2.test.ts", "import fc from 'fast-check'\nbaz()\n"),
  file("packages/a/test/zed.test.ts", "bar_unrelated\n"),
];

describe("ledger command", () => {
  it("one line per item: the strongest evidence first, +N for the rest, none when absent", async () => {
    const r = await run(["ledger"], { cwd: CWD, files: base });
    expect(lines(r.stdout)).toEqual([
      "packages/a/src/bar.ts#bar none none",
      "packages/a/src/baz.ts#baz example property runs 100 packages/a/test/baz2.test.ts +1",
      "packages/a/src/foo.ts#foo probabilistic property runs 100 seed 1337 packages/a/test/foo.test.ts +2",
      "ok ledger 3 items, 2 verified, 1 unsafe",
    ]);
  });

  it("a lone example reads `example <path>`", async () => {
    const r = await run(["ledger"], {
      cwd: CWD,
      files: [
        file("packages/a/src/foo.ts", "export function foo() {}\n"),
        file("packages/a/test/f.test.ts", "foo()\n"),
      ],
    });
    expect(lines(r.stdout)[0]).toBe("packages/a/src/foo.ts#foo example example packages/a/test/f.test.ts");
  });

  it("json records carry item, rung and the evidence line", async () => {
    const r = await run(["ledger", "--format=json"], { cwd: CWD, files: base });
    expect(lines(r.stdout).map((l) => JSON.parse(l))[0]).toEqual({
      kind: "ledger",
      item: "packages/a/src/bar.ts#bar",
      rung: "none",
      evidence: "none",
    });
  });

  const committed = (rung: string, path = "tooling/ledger/ledger.json") =>
    file(
      path,
      JSON.stringify({
        version: 1,
        unsafe: 0,
        exports: [{ pkg: "a", name: "foo", file: "packages/a/src/foo.ts", rung }],
      }),
    );

  it("--diff: a lowered rung is E1706 at the item's file; counts include lowered", async () => {
    const r = await run(["ledger", "--diff"], { cwd: CWD, files: [...base, committed("exhaustive")] });
    expect(r.code).toBe(1);
    expect(lines(r.stdout)).toEqual([
      "E1706 packages/a/src/foo.ts:1:1 ledger rung lowered: packages/a/src/foo.ts#foo exhaustive -> probabilistic",
      "  see: k.testing",
      "fail ledger --diff 3 items, 2 verified, 1 unsafe, 1 lowered",
    ]);
    const json = await run(["ledger", "--diff", "--format=json"], {
      cwd: CWD,
      files: [...base, committed("exhaustive")],
    });
    expect(JSON.parse(lines(json.stdout)[0] ?? "")).toMatchObject({
      kind: "diag",
      code: "E1706",
      path: "packages/a/src/foo.ts",
      line: 1,
      col: 1,
    });
  });

  it("--diff: an item that is not a packages/ path is reported without a location", async () => {
    const odd = file(
      "tooling/ledger/ledger.json",
      JSON.stringify({ version: 1, unsafe: 0, exports: [{ pkg: "k", name: "1", file: "k.a", rung: "example" }] }),
    );
    const r = await run(["ledger", "--diff", "--format=json"], {
      cwd: CWD,
      files: [odd, file("spec/kernel/k.a.md", "# k.a\n**Conformance.**\n- One works.\n")],
    });
    const diag = JSON.parse(lines(r.stdout)[0] ?? "");
    expect(diag).toEqual({
      kind: "diag",
      code: "E1706",
      message: "ledger rung lowered: k.a#1 example -> none",
      see: "k.testing",
    });
  });

  it("--diff prefers .keel/ledger.json over the tooling ledger", async () => {
    const files = [...base, committed("exhaustive", ".keel/ledger.json"), committed("none")];
    expect((await run(["ledger", "--diff"], { cwd: CWD, files })).code).toBe(1);
    const reversed = [...base, committed("none", ".keel/ledger.json"), committed("exhaustive")];
    const r = await run(["ledger", "--diff"], { cwd: CWD, files: reversed });
    expect(r.code).toBe(0);
    expect(lines(r.stdout)).toEqual(["ok ledger --diff 3 items, 2 verified, 1 unsafe, 0 lowered"]);
  });

  it("--diff without a committed ledger, or with an unreadable one, compares against nothing", async () => {
    for (const files of [
      base,
      [...base, file(".keel/ledger.json", "{not json")],
      [...base, file(".keel/ledger.json", "{}")],
    ]) {
      const r = await run(["ledger", "--diff"], { cwd: CWD, files });
      expect(r.code).toBe(0);
      expect(lines(r.stdout)).toEqual(["ok ledger --diff 3 items, 2 verified, 1 unsafe, 0 lowered"]);
    }
  });
});
