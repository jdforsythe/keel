// E1707 (rfc:0049): `keel ledger --diff` reports every clause of a conformance-covered or frozen section at `none`.
import { describe, expect, it } from "vitest";
import { run } from "../src/index.ts";
import { coverageGaps } from "../src/internal/coverageGaps.ts";
import { specStatus } from "../src/internal/specStatus.ts";

const CWD = "/work/app";
const file = (path: string, source: string) => ({ path, source });
const lines = (out: string): string[] => out.split("\n").filter((l) => l !== "");
const section = (id: string, status: string, clauses: readonly string[]): string =>
  [`# ${id}`, `status: ${status}`, "", "**Conformance.**", ...clauses.map((c) => `- ${c}`), ""].join("\n");
const cited = (path: string, id: string, clause: string) =>
  file(path, `// Spec: ${id}, clause "${clause}"\nimport { it } from "vitest";\nit("t", () => {});\n`);

describe("specStatus", () => {
  it("reads the status line of kernel and std sections only", () => {
    const m = specStatus([
      file("spec/kernel/k.a.md", "# k.a\nstatus: conformance-covered\n"),
      file("spec/std/std.b.md", "# std.b\n\nstatus:   frozen  \n"),
      file("spec/kernel/k.c.md", "# k.c\nno status\n"),
      file("spec/other/k.d.md", "status: frozen\n"),
      file("spec/kernel/k.e.md", "# k.e\n  status: frozen\n"),
    ]);
    expect([...m]).toEqual([
      ["k.a", "conformance-covered"],
      ["std.b", "frozen"],
    ]);
  });
});

describe("coverageGaps", () => {
  const rec = (item: string, rung: "none" | "example") => ({ kind: "ledger" as const, item, rung, evidence: [] });

  it("a covered or frozen section's `none` clause is E1707 at the clause line; other statuses are not checked", () => {
    const files = [
      file("spec/kernel/k.a.md", section("k.a", "conformance-covered", ["One.", "Two."])),
      file("spec/std/std.f.md", section("std.f", "frozen", ["Only."])),
      file("spec/kernel/k.i.md", section("k.i", "implemented", ["Untested."])),
    ];
    const records = [rec("k.a#1", "example"), rec("k.a#2", "none"), rec("std.f#1", "none"), rec("k.i#1", "none")];
    expect(coverageGaps(files, records, "")).toEqual([
      {
        kind: "diag",
        code: "E1707",
        path: "spec/kernel/k.a.md",
        line: 6,
        col: 1,
        message: "section k.a is conformance-covered but clause 2 has no evidence",
        see: "k.ledger",
      },
      {
        kind: "diag",
        code: "E1707",
        path: "spec/std/std.f.md",
        line: 5,
        col: 1,
        message: "section std.f is frozen but clause 1 has no evidence",
        see: "k.ledger",
      },
    ]);
  });

  it("a covered section without a readable clause list is E1707 at line 1, unless a scope is given", () => {
    const files = [
      file("spec/kernel/k.p.md", "# k.p\nstatus: conformance-covered\n\n**Conformance.** Inline prose.\n"),
    ];
    expect(coverageGaps(files, [], "")).toEqual([
      {
        kind: "diag",
        code: "E1707",
        path: "spec/kernel/k.p.md",
        line: 1,
        col: 1,
        message: "section k.p is conformance-covered but has no Conformance clause",
        see: "k.ledger",
      },
    ]);
    expect(coverageGaps(files, [], "k.p")).toEqual([]);
  });

  it("only clauses present in the scoped records are checked", () => {
    const files = [file("spec/kernel/k.a.md", section("k.a", "conformance-covered", ["One."]))];
    expect(coverageGaps(files, [], "golden-1:")).toEqual([]);
  });
});

describe("keel ledger --diff with E1707", () => {
  const spec = file("spec/kernel/k.a.md", section("k.a", "conformance-covered", ["One works.", "Two works."]));
  const one = cited("packages/a/conformance/one.test.ts", "k.a", "One works.");
  const two = cited("packages/a/conformance/two.test.ts", "k.a", "Two works.");

  it("fails while a clause of a covered section has no evidence, and passes once a conformance file cites it", async () => {
    const gap = await run(["ledger", "--diff"], { cwd: CWD, files: [spec, one] });
    expect(gap.code).toBe(1);
    expect(lines(gap.stdout)).toEqual([
      "E1707 spec/kernel/k.a.md:6:1 section k.a is conformance-covered but clause 2 has no evidence",
      "  see: k.ledger",
      "fail ledger --diff 2 items, 1 verified, 0 unsafe, 0 warnings, 1 example, 0 lowered, 1 uncovered",
    ]);
    const ok = await run(["ledger", "--diff"], { cwd: CWD, files: [spec, one, two] });
    expect(ok.code).toBe(0);
    expect(lines(ok.stdout)).toEqual([
      "ok ledger --diff 2 items, 2 verified, 0 unsafe, 0 warnings, 2 example, 0 lowered, 0 uncovered",
    ]);
  });

  it("plain `keel ledger` does not report E1707", async () => {
    const r = await run(["ledger"], { cwd: CWD, files: [spec, one] });
    expect(r.code).toBe(0);
    expect(r.stdout).not.toContain("E1707");
  });
});
