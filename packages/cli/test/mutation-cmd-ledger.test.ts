import { createHash } from "node:crypto";
// Mutation-killing tests for the ledger: item discovery (buildLedger) and its rendering, file and diff (ledgerCommand).
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { buildLedger } from "../src/internal/buildLedger.ts";
import type { Write } from "../src/types/Write.ts";

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
/** A test file whose one test body runs `body`. */
const test = (path: string, body: string, head = "") =>
  file(path, `${head}import { it } from "vitest";\nit("t", () => {\n  ${body}\n});\n`);
const FC = 'import fc from "fast-check";\n';
/** sha256 of the source "a" a test report holds. */
const SHA_A = createHash("sha256").update("a").digest("hex");

describe("buildLedger", () => {
  it("lists every export sorted by path, with evidence from the same package's tests only", () => {
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
      test(
        "packages/a/test/z.test.ts",
        "zeta(); expect(alpha).toBeDefined();",
        'import { alpha } from "../src/alpha.ts";\n',
      ),
      file("packages/a/test/notes.md", "zeta alpha mid\n"),
      test("packages/b/test/z.test.ts", "zeta();"),
    ]);
    expect(items.map((i) => i.item)).toEqual([
      "packages/a/src/alpha.ts#alpha",
      "packages/a/src/arrow.ts#arrow",
      "packages/a/src/mid.ts#mid",
      "packages/a/src/ty.ts#ty",
      "packages/a/src/val.ts#val",
      "packages/a/src/zeta.ts#zeta",
    ]);
    const ev = (name: string) => items.find((i) => i.item.endsWith(`#${name}`))?.evidence;
    expect(ev("zeta")).toEqual([{ ev: EX, path: "packages/a/test/z.test.ts" }]);
    expect(ev("alpha")).toEqual([{ ev: EX, path: "packages/a/test/z.test.ts" }]);
    expect(ev("mid")).toEqual([]);
    expect(items[0]?.pkg).toBe("a");
    expect(unsafe).toBe(0);
  });

  it("an overloaded export is one item", () => {
    const { items } = buildLedger([
      file("packages/a/src/foo.ts", "export function foo(a: string): void;\nexport function foo(a: number): void;\n"),
    ]);
    expect(items.map((i) => i.item)).toEqual(["packages/a/src/foo.ts#foo"]);
  });

  it("matches the exported name as a whole identifier, including names with $", () => {
    const { items } = buildLedger([
      file("packages/a/src/foo.ts", "export function foo() {}\n"),
      file("packages/a/src/x$.ts", "export function x$() {}\n"),
      test("packages/a/test/t.test.ts", "foobar();"),
      test("packages/a/test/u.test.ts", "x();"),
    ]);
    expect(items.find((i) => i.item.endsWith("#foo"))?.evidence).toEqual([]);
    expect(items.find((i) => i.item.endsWith("#x$"))?.evidence).toEqual([]);
  });

  it("comments, strings, skipped and todo tests, and code outside test bodies are not evidence", () => {
    const { items } = buildLedger([
      file("packages/a/src/foo.ts", "export function foo() {}\n"),
      test("packages/a/test/comment.test.ts", "// foo()\n  /* foo() */ expect(1).toBe(1);"),
      test("packages/a/test/string.test.ts", 'expect("foo()").toBe(`foo`);'),
      file(
        "packages/a/test/skip.test.ts",
        'import { it } from "vitest";\nit.skip("t", () => foo());\nit.todo("foo");\n',
      ),
      file("packages/a/test/top.test.ts", 'import { it } from "vitest";\nconst x = foo();\nit("t", () => {});\n'),
    ]);
    expect(items[0]?.evidence).toEqual([]);
  });

  it("a property run gives its runs and seed; the strongest seeded run wins", () => {
    const { items } = buildLedger([
      file("packages/a/src/foo.ts", "export function foo() {}\n"),
      test(
        "packages/a/test/p.test.ts",
        "foo(); fc.assert(p, { seed: 7, numRuns: 50 }); fc.assert(p, { numRuns: 300 });",
        FC,
      ),
      test("packages/a/conformance/c.test.ts", "foo();"),
    ]);
    expect(items[0]?.evidence).toEqual([
      { ev: prop(50, 7), path: "packages/a/test/p.test.ts" },
      { ev: EX, path: "packages/a/conformance/c.test.ts" },
    ]);
  });

  it("app modules: exports and default exports keyed <app>:<path>, manifests and parts left out, app tests only", () => {
    const { items, appUnsafe } = buildLedger([
      file(
        "apps/g/modules/todos/List.tsx",
        "export const Props = 1\nexport const uses = []\nexport default function () {}\n",
      ),
      file("apps/g/modules/todos/addTodo.ts", "export const addTodo = () => unsafe('why', () => 1)\n"),
      file("apps/g/modules/todos/module.ts", "export default module({})\n"),
      file("apps/g/modules/todos/routes.ts", "export const routes = []\n"),
      file("apps/g/modules/todos/addTodo.test.ts", 'import { it } from "vitest";\nit("t", () => addTodo());\n'),
      test("apps/g/test/list.test.ts", "render(List);", 'import List from "../modules/todos/List.tsx";\n'),
      test("apps/h/test/other.test.ts", "addTodo();"),
    ]);
    expect(items).toEqual([
      { item: "g:todos/List.tsx#List", pkg: "g", evidence: [{ ev: EX, path: "apps/g/test/list.test.ts" }] },
      {
        item: "g:todos/addTodo.ts#addTodo",
        pkg: "g",
        evidence: [{ ev: EX, path: "apps/g/modules/todos/addTodo.test.ts" }],
      },
    ]);
    expect(appUnsafe).toEqual({ g: 1, h: 0 });
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

  it("spec clauses take the tests of conformance files whose // Spec: header names the section and clause", () => {
    const spec = file(
      "spec/kernel/k.a.b.md",
      "# k.a.b\n\n**Conformance.**\n- One works.\n- Two works.\n\n**Other.**\n- Not a clause.\n",
    );
    const body = 'import { it } from "vitest";\nit("t", () => {});\n';
    const { items, diags } = buildLedger([
      spec,
      file("spec/std/s.c.md", "# s\n**Conformance.**\n- Std clause.\n"),
      file("spec/kernel/none.md", "# no conformance\n- x\n"),
      file(
        "packages/a/conformance/yes.test.ts",
        `// Spec: k.a.b, clause "One works."\n${FC}import { it } from "vitest";\nit("t", () => fc.assert(p, { seed: 1, numRuns: 100 }));\n`,
      ),
      file("packages/a/conformance/lookalike.test.ts", `// Spec: k.aXb, clause "One works."\n${body}`),
      file("packages/a/conformance/longer.test.ts", `// Spec: k.a.bc, clause "One works."\n${body}`),
      file("packages/a/conformance/late.test.ts", `const x = 1\n// Spec: k.a.b, clause "One works."\n${body}`),
      file("packages/a/conformance/skipped.test.ts", '// Spec: k.a.b, clause "One works."\nit.skip("t", () => {});\n'),
      file("packages/a/conformance/split.test.ts", `// Spec: k.a.b\n// clause "One works."\n${body}`),
      file(
        "packages/a/conformance/two.test.ts",
        `import { x } from "y";\nimport {\n  z,\n} from "w";\n\n// Spec: k.a.b, clause "Two works."\n${body}`,
      ),
      file("packages/a/test/notconf.test.ts", `// Spec: k.a.b, clause "One works."\n${body}`),
      file("packages/a/conformance/std.test.ts", `// Spec: s.c, clause "Std clause."\n${body}`),
    ]);
    expect(items).toEqual([
      {
        item: "k.a.b#1",
        evidence: [
          { ev: prop(100, 1), path: "packages/a/conformance/yes.test.ts" },
          { ev: EX, path: "packages/a/conformance/split.test.ts" },
        ],
      },
      { item: "k.a.b#2", evidence: [{ ev: EX, path: "packages/a/conformance/two.test.ts" }] },
      { item: "s.c#1", evidence: [{ ev: EX, path: "packages/a/conformance/std.test.ts" }] },
    ]);
    expect(diags).toEqual([]);
  });

  it("a clause is cited by its quoted text: backticks, quote style, spacing, case and final period aside (rfc:0049)", () => {
    const spec = file(
      "spec/kernel/k.x.md",
      [
        "# k.x",
        "**Conformance.**",
        "- `mount` then `dispose` leaves zero listeners.",
        "- A tree attaches N listeners.",
        "- A tree attaches N listeners to its root.",
        '- `caller` is `""` when absent.',
        "",
      ].join("\n"),
    );
    const body = 'import { it } from "vitest";\nit("t", () => {});\n';
    const at = (path: string, head: string) => file(`packages/${path}`, `${head}\n${body}`);
    const { items } = buildLedger([
      spec,
      file("spec/kernel/k.y.md", "# k.y\n**Conformance.**\n- A tree attaches N listeners.\n"),
      at("a/conformance/bare.test.ts", '// Spec: k.x, clause "mount then dispose leaves zero listeners"'),
      at("a/conformance/curly.test.ts", "// Spec: k.x, clause \u201CMOUNT then  dispose leaves zero listeners.\u201D"),
      at("a/conformance/wrap.test.ts", '// Spec: k.x, clause "A tree attaches N\n// listeners to its root." Seed 1.'),
      at("a/conformance/gap.test.ts", '// Spec: k.x, clause "A tree attaches N\n\n// listeners to its root."'),
      at("a/conformance/cut.test.ts", '// Spec: k.x, clause "A tree attaches N\n// Clause: listeners to its root."'),
      at("a/conformance/number.test.ts", "// Spec: k.x Conformance 2"),
      at("a/conformance/unquoted.test.ts", "// Spec: k.x Conformance: A tree attaches N listeners."),
      at("a/conformance/other.test.ts", '// Spec: k.y\n// Spec: k.z, clause "A tree attaches N listeners."'),
      at("b/conformance/cross.test.ts", '// Spec: k.x, clause "`caller` is `""` when absent."'),
      at("a/conformance/notx.test.ts", '// Spec: k.xy, clause "A tree attaches N listeners."'),
    ]);
    const paths = (item: string) => items.find((i) => i.item === item)?.evidence.map((e) => e.path);
    expect(paths("k.x#1")).toEqual(["packages/a/conformance/bare.test.ts", "packages/a/conformance/curly.test.ts"]);
    expect(paths("k.x#2")).toEqual([]);
    expect(paths("k.x#3")).toEqual(["packages/a/conformance/wrap.test.ts"]);
    expect(paths("k.x#4")).toEqual(["packages/b/conformance/cross.test.ts"]);
    expect(paths("k.y#1")).toEqual([]);
  });

  it("a // Clause: header is not evidence; it is W1706 with the // Spec: rewrite as fix", () => {
    const { items, diags } = buildLedger([
      file("spec/kernel/k.a.md", "# k.a\n**Conformance.**\n- One works.\n"),
      file(
        "packages/a/conformance/one.test.ts",
        '// @vitest-environment happy-dom\n// Clause: One works.\nit("t", () => {});\n',
      ),
      file("packages/b/conformance/two.test.ts", 'import { it } from "vitest";\n// Clause: Two.\nit("t", () => {});\n'),
      file("packages/b/conformance/late.test.ts", 'it("t", () => {});\n// Clause: Late.\n'),
    ]);
    expect(items).toEqual([{ item: "k.a#1", evidence: [] }]);
    expect(diags).toEqual([
      {
        kind: "diag",
        code: "W1706",
        path: "packages/a/conformance/one.test.ts",
        line: 2,
        col: 1,
        message: "clause header not counted by the ledger; name it with // Spec:",
        fix: '-// Clause: One works.\n+// Spec: k.a, clause "One works."',
        see: "k.ledger",
      },
      {
        kind: "diag",
        code: "W1706",
        path: "packages/b/conformance/two.test.ts",
        line: 2,
        col: 1,
        message: "clause header not counted by the ledger; name it with // Spec:",
        fix: '-// Clause: Two.\n+// Spec: <section>, clause "Two."',
        see: "k.ledger",
      },
    ]);
  });
});

const base = [
  file("packages/a/src/foo.ts", "export function foo() {}\n"),
  file("packages/a/src/bar.ts", "export const bar = () => unsafe('why', () => 1)\n"),
  file("packages/a/src/baz.ts", "export function baz() {}\n"),
  test("packages/a/test/foo.test.ts", "foo(); fc.assert(p, { seed: 1337, numRuns: 100 });", FC),
  test("packages/a/test/foo2.test.ts", "foo();"),
  test("packages/a/test/foo3.test.ts", "foo();"),
  test("packages/a/test/baz.test.ts", "baz();"),
  test("packages/a/test/baz2.test.ts", "baz(); fc.assert(p);", FC),
  test("packages/a/test/zed.test.ts", "bar_unrelated();"),
];

describe("ledger command", () => {
  it("one line per item: the strongest evidence first, +N for the rest, none when absent", async () => {
    const r = await run(["ledger"], { cwd: CWD, files: base });
    expect(lines(r.stdout)).toEqual([
      "packages/a/src/bar.ts#bar none none",
      "packages/a/src/baz.ts#baz example property runs 100 packages/a/test/baz2.test.ts +1",
      "packages/a/src/foo.ts#foo probabilistic property runs 100 seed 1337 packages/a/test/foo.test.ts +2",
      "ok ledger 3 items, 2 verified, 1 unsafe, 0 warnings, 2 example, 1 probabilistic",
    ]);
  });

  it("a lone example reads `example <path>`", async () => {
    const r = await run(["ledger"], {
      cwd: CWD,
      files: [file("packages/a/src/foo.ts", "export function foo() {}\n"), test("packages/a/test/f.test.ts", "foo();")],
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

  it("W1706 notes come first and count as warnings; they do not fail the run", async () => {
    const files = [...base, file("packages/a/conformance/c.test.ts", '// Clause: One.\nit("t", () => {});\n')];
    const r = await run(["ledger", "--quiet"], { cwd: CWD, files });
    expect(r.code).toBe(0);
    expect(lines(r.stdout)).toEqual([
      "ok ledger 3 items, 2 verified, 1 unsafe, 1 warnings, 2 example, 1 probabilistic",
    ]);
    const json = await run(["ledger", "--format=json"], { cwd: CWD, files });
    expect(JSON.parse(lines(json.stdout)[0] ?? "")).toMatchObject({ code: "W1706" });
  });

  it("--write <file> writes the ledger file: unsafe, rungs, mutation claims, exports, clauses", async () => {
    const writes: Write[] = [];
    const report = JSON.stringify({
      thresholds: { high: 80, low: 60, break: 50 },
      files: {
        "src/a.ts": {
          source: "a",
          mutants: [{ status: "Killed" }, { status: "Timeout" }, { status: "Survived" }, { status: "Ignored" }],
        },
      },
    });
    const files = [
      ...base,
      file("spec/kernel/k.a.md", "# k.a\n**Conformance.**\n- One works.\n"),
      file("packages/a/reports/mutation/mutation.json", report),
      file("packages/a/src/a.ts", "a"),
    ];
    const r = await run(["ledger", "--write", "tooling/ledger/ledger.json"], {
      cwd: CWD,
      files,
      apply: (w) => void writes.push(...w),
    });
    expect(r.code).toBe(0);
    expect(lines(r.stdout)).toEqual([
      "ok ledger 4 items, 2 verified, 1 unsafe, 0 warnings, 2 example, 1 probabilistic",
    ]);
    expect(writes.map((w) => [w.path, w.readonly])).toEqual([["tooling/ledger/ledger.json", false]]);
    expect(JSON.parse(writes[0]?.content ?? "")).toEqual({
      version: 1,
      unsafe: 1,
      rungs: { example: 2, probabilistic: 1, exhaustive: 0, proven: 0, monitored: 0 },
      mutation: {
        packages: { a: { score: 66.67, threshold: 50 } },
        claims: [{ file: "packages/a/src/a.ts", sha: SHA_A, killed: 2, survived: 1, noCoverage: 0, score: 66.67 }],
      },
      exports: [
        { pkg: "a", name: "bar", file: "packages/a/src/bar.ts", rung: "none" },
        { pkg: "a", name: "baz", file: "packages/a/src/baz.ts", rung: "example" },
        { pkg: "a", name: "foo", file: "packages/a/src/foo.ts", rung: "probabilistic" },
      ],
      clauses: [{ item: "k.a#1", rung: "none" }],
    });
    expect(writes[0]?.content?.endsWith("}\n")).toBe(true);
    const none: Write[] = [];
    await run(["ledger", "--quiet"], { cwd: CWD, files: base, apply: (w) => void none.push(...w) });
    expect(none).toEqual([]);
    const plain: Write[] = [];
    await run(["ledger", "--write", "l.json"], { cwd: CWD, files: base, apply: (w) => void plain.push(...w) });
    expect(JSON.parse(plain[0]?.content ?? "")).not.toHaveProperty("mutation");
  });

  const committed = (rung: string, path = "tooling/ledger/ledger.json", unsafe = 1) =>
    file(
      path,
      JSON.stringify({
        version: 1,
        unsafe,
        exports: [{ pkg: "a", name: "foo", file: "packages/a/src/foo.ts", rung }],
      }),
    );

  it("--diff: a lowered rung is E1706 at the item's file; counts include lowered; nothing is written", async () => {
    const writes: Write[] = [];
    const r = await run(["ledger", "--diff", "--write", "tooling/ledger/ledger.json"], {
      cwd: CWD,
      files: [...base, committed("exhaustive")],
      apply: (w) => void writes.push(...w),
    });
    expect(r.code).toBe(1);
    expect(writes).toEqual([]);
    expect(lines(r.stdout)).toEqual([
      "E1706 packages/a/src/foo.ts:1:1 ledger rung lowered: packages/a/src/foo.ts#foo exhaustive -> probabilistic",
      "  see: k.ledger",
      "fail ledger --diff 3 items, 2 verified, 1 unsafe, 0 warnings, 2 example, 1 probabilistic, 1 lowered, 0 uncovered",
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

  it("--diff: app items point at apps/<app>/modules, clauses at their spec section", async () => {
    const odd = file(
      "tooling/ledger/ledger.json",
      JSON.stringify({
        version: 1,
        unsafe: 0,
        exports: [{ pkg: "g", name: "add", file: "g:todos/add.ts", rung: "example" }],
        clauses: [
          { item: "k.a#1", rung: "example" },
          { item: "std.s#1", rung: "example" },
        ],
      }),
    );
    const r = await run(["ledger", "--diff", "--format=json"], {
      cwd: CWD,
      files: [
        odd,
        file("apps/g/modules/todos/add.ts", "export const add = () => 1\n"),
        file("spec/kernel/k.a.md", "# k.a\n**Conformance.**\n- One works.\n"),
        file("spec/std/std.s.md", "# s\n**Conformance.**\n- One works.\n"),
      ],
    });
    expect(
      lines(r.stdout)
        .slice(0, 3)
        .map((l) => JSON.parse(l).path),
    ).toEqual(["apps/g/modules/todos/add.ts", "spec/kernel/k.a.md", "spec/std/std.s.md"]);
  });

  it("--diff: an unsafe count above the committed one is E1706 at the ledger file", async () => {
    const r = await run(["ledger", "--diff"], { cwd: CWD, files: [...base, committed("probabilistic", undefined, 0)] });
    expect(r.code).toBe(1);
    expect(lines(r.stdout)[0]).toBe("E1706 tooling/ledger/ledger.json unsafe count up 0 -> 1");
    const same = await run(["ledger", "--diff"], { cwd: CWD, files: [...base, committed("probabilistic")] });
    expect(same.code).toBe(0);
  });

  it("--scope keeps matching items; its unsafe count is the matching apps', compared with zero", async () => {
    const files = [
      ...base,
      committed("exhaustive"),
      file("apps/g/modules/x/add.ts", "export const add = () => 1\n"),
      file("apps/h/modules/y/sub.ts", "export const sub = () => unsafe('why', () => 1)\n"),
      file("packages/a/conformance/c.test.ts", '// Clause: One.\nit("t", () => {});\n'),
    ];
    const g = await run(["ledger", "--scope", "g:"], { cwd: CWD, files });
    expect(lines(g.stdout)).toEqual([
      "g:x/add.ts#add none none",
      "ok ledger 1 items, 0 verified, 0 unsafe, 0 warnings",
    ]);
    expect((await run(["ledger", "--diff", "--scope", "g:"], { cwd: CWD, files })).code).toBe(0);
    const h = await run(["ledger", "--diff", "--scope", "h:"], { cwd: CWD, files });
    expect(lines(h.stdout)[0]).toBe("E1706 tooling/ledger/ledger.json unsafe count up 0 -> 1");
    const deep = await run(["ledger", "--diff", "--scope", "h:y/"], { cwd: CWD, files });
    expect(deep.code).toBe(1);
  });

  it("--diff prefers .keel/ledger.json over the tooling ledger; --write names the file to compare", async () => {
    const files = [...base, committed("exhaustive", ".keel/ledger.json"), committed("none")];
    expect((await run(["ledger", "--diff"], { cwd: CWD, files })).code).toBe(1);
    expect((await run(["ledger", "--diff", "--write", "tooling/ledger/ledger.json"], { cwd: CWD, files })).code).toBe(
      0,
    );
    const reversed = [...base, committed("none", ".keel/ledger.json"), committed("exhaustive")];
    const r = await run(["ledger", "--diff"], { cwd: CWD, files: reversed });
    expect(r.code).toBe(0);
    expect(lines(r.stdout)).toEqual([
      "ok ledger --diff 3 items, 2 verified, 1 unsafe, 0 warnings, 2 example, 1 probabilistic, 0 lowered, 0 uncovered",
    ]);
  });

  it("--diff without a committed ledger, or with an unreadable one, compares against nothing", async () => {
    for (const files of [
      base,
      [...base, file(".keel/ledger.json", "{not json")],
      [...base, file(".keel/ledger.json", "{}")],
    ]) {
      const r = await run(["ledger", "--diff"], { cwd: CWD, files });
      expect(r.code).toBe(0);
      expect(lines(r.stdout)).toEqual([
        "ok ledger --diff 3 items, 2 verified, 1 unsafe, 0 warnings, 2 example, 1 probabilistic, 0 lowered, 0 uncovered",
      ]);
    }
  });
});
