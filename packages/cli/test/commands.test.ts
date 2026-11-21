// Command behaviour beyond the conformance suite: unavailable commands, docs, explain, ledger, custom formatters.
import { s } from "@keel/schema";
import { describe, expect, it } from "vitest";
import { formatter, run } from "../src/index.ts";
import { normalize } from "../src/internal/normalize.ts";
import { render } from "../src/internal/render.ts";

const CWD = "/work/app";
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");

describe("commands", () => {
  it("commands not available in-process report info I1055 and exit 0", async () => {
    for (const cmd of ["dev", "inspect", "render"]) {
      const r = await run([cmd], { cwd: CWD });
      expect(r.code).toBe(0);
      expect(lines(r.stdout)[0]).toMatch(/^I1055 /);
    }
  });

  it("docs in the repo tree: section, --for, the map, unknown id (E1052), two forms (E1052)", async () => {
    const files = [
      { path: "spec/00-map.md", source: "# map\n| k.cli | cli |\n" },
      { path: "spec/kernel/k.cli.md", source: "# k.cli\nE1051 unknown command\n" },
    ];
    expect((await run(["docs", "k.cli"], { cwd: CWD, files })).stdout).toBe(
      "# k.cli\nE1051 unknown command\nok docs k.cli\n",
    );
    expect((await run(["docs"], { cwd: CWD, files })).stdout).toContain("# map");
    expect((await run(["docs", "--for", "E1051"], { cwd: CWD, files })).stdout).toBe(
      "k.cli:2 E1051 unknown command\nok docs --for E1051 1 lines\n",
    );
    const bad = await run(["docs", "k.nope"], { cwd: CWD, files });
    expect(bad.code).toBe(2);
    expect(bad.stdout).toMatch(/^E1052 /);
    expect(await run(["docs", "k.cli", "--for", "E1"], { cwd: CWD, files })).toMatchObject({ code: 2 });
    expect(await run(["spec", "k.cli"], { cwd: CWD, files })).toMatchObject({ code: 2 });
  });

  it("explain without a code is an empty result; --code is not an explain flag", async () => {
    expect((await run(["explain"], { cwd: CWD })).stdout).toBe("ok explain 0 codes\n");
    expect((await run(["explain", "--code", "E1051"], { cwd: CWD })).code).toBe(2);
  });

  it("test in-process reports the empty run", async () => {
    expect((await run(["test", "--format=json"], { cwd: CWD })).stdout).toBe(
      '{"kind":"summary","ok":true,"name":"test","counts":{"tests":0,"failed":0,"skipped":0}}\n',
    );
  });

  it("no command, a repeated flag, a missing value, an extra argument: usage errors, exit 2", async () => {
    for (const argv of [
      [],
      ["check", "--limit=1", "--limit=2"],
      ["check", "--limit"],
      ["ledger", "extra"],
      ["check", "-q"],
    ]) {
      const r = await run(argv, { cwd: CWD });
      expect(r.code).toBe(2);
      expect(r.stdout).toMatch(/^E105[12] /);
    }
  });

  it("ledger: rungs from tests via @keel/testing, spec clauses from // Spec: headers, --diff reports E1706", async () => {
    const files = [
      { path: "packages/a/src/foo.ts", source: "export function foo() {}\n" },
      { path: "packages/a/src/bar.ts", source: "export const bar = () => unsafe('why', () => 1)\n" },
      { path: "packages/a/src/baz.ts", source: "export function baz() {}\n" },
      { path: "packages/a/src/internal/qux.ts", source: "export function qux() {}\n" },
      {
        path: "packages/a/test/foo.test.ts",
        source: "import fc from 'fast-check'\nit('t', () => { foo(); fc.assert(p, { seed: 1337, numRuns: 100 }) })\n",
      },
      {
        path: "packages/a/test/baz.test.ts",
        source: "import fc from 'fast-check'\nit('t', () => { baz(); fc.assert(p) })\n",
      },
      { path: "packages/a/test/skipped.test.ts", source: "it.skip('t', () => bar())\n// bar()\n" },
      {
        path: "packages/a/conformance/one.test.ts",
        source:
          '// Spec: k.a, clause "One works."\nimport fc from "fast-check"\nit("t", () => fc.assert(p, { seed: 1337, numRuns: 200 }))\n',
      },
      { path: "spec/kernel/k.a.md", source: "# k.a\n\n**Conformance.**\n- One works.\n- Two works.\n" },
      {
        path: "tooling/ledger/ledger.json",
        source: JSON.stringify({
          version: 1,
          unsafe: 0,
          exports: [{ pkg: "a", name: "bar", file: "packages/a/src/bar.ts", rung: "example" }],
        }),
      },
    ];
    const plain = await run(["ledger"], { cwd: CWD, files });
    expect(plain.stdout).toBe(
      [
        "packages/a/src/bar.ts#bar none none",
        "packages/a/src/baz.ts#baz example property runs 100 packages/a/test/baz.test.ts",
        "packages/a/src/foo.ts#foo probabilistic property runs 100 seed 1337 packages/a/test/foo.test.ts",
        "k.a#1 probabilistic property runs 200 seed 1337 packages/a/conformance/one.test.ts",
        "k.a#2 none none",
        "ok ledger 5 items, 3 verified, 1 unsafe, 0 warnings, 1 example, 2 probabilistic",
        "",
      ].join("\n"),
    );
    const diff = await run(["ledger", "--diff"], { cwd: CWD, files });
    expect(diff.code).toBe(1);
    expect(lines(diff.stdout)[0]).toBe(
      "E1706 packages/a/src/bar.ts:1:1 ledger rung lowered: packages/a/src/bar.ts#bar example -> none",
    );
  });

  it("a registered kind renders through its formatter in every mode; json is the schema encoding", () => {
    const Report = s.object({ kind: s.literal("orders.report"), id: s.string(), total: s.number() });
    formatter("orders.report", {
      schema: Report,
      compact: (r) => `${r.id} ${r.total}`,
      pretty: (r) => `${r.id}: ${r.total}`,
    });
    const rs = normalize([{ kind: "orders.report", id: "o1", total: 3, extra: true }]);
    const o = { quiet: false, limit: undefined, verbose: false, code: undefined, command: "x" };
    expect(render(rs, { ...o, mode: "compact" })).toBe("o1 3\n");
    expect(render(rs, { ...o, mode: "pretty" })).toBe("o1: 3\n");
    expect(render(rs, { ...o, mode: "json" })).toBe('{"kind":"orders.report","id":"o1","total":3}\n');
    expect(normalize([{ kind: "orders.report", id: 1 }])[0]).toMatchObject({ code: "E1054" });
  });
});
