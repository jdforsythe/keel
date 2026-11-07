// Spec: k.cli Conformance on `keel check` output shape, plus exit codes (0 none, 1 error diagnostics, 2 usage).
// MCP/LSP parity ("check --format=json, the MCP `check` tool, and LSP diagnostics yield the same set"; MCP input schemas) is covered in surfaces.test.ts.
// Spec: k.cli, clause "A clean `keel check` in compact prints exactly one line."
// Spec: k.cli, clause "Compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths."
// Spec: k.cli, clause "In json every line parses, has `kind`, and the last line has `kind: "summary"`."
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, cleanProject, dirtyProject, keel, lines, parseJsonLines } from "./fixtures";

const ESC = String.fromCharCode(27);

describe("k.cli check output", () => {
  it("a clean `keel check` in compact prints exactly one line", async () => {
    const r = await keel(["check", "--format=compact"], { files: cleanProject() });
    expect(r.code).toBe(0);
    expect(lines(r.stdout)).toHaveLength(1);
  });

  it("compact and json output contain no ANSI escapes, no carriage returns, and no absolute paths", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("compact", "json"), fc.integer({ min: 0, max: 12 }), async (fmt, n) => {
        const r = await keel(["check", `--format=${fmt}`], {
          files: [...cleanProject(), ...dirtyProject(n)],
          tty: true,
        });
        expect(r.stdout).not.toContain(ESC);
        expect(r.stdout).not.toContain("\r");
        expect(r.stdout).not.toContain("/work/app");
        expect(/(^|[\s"'(])\/[A-Za-z0-9_.-]+\//.test(r.stdout.replace(/\.\.\. \+/g, ""))).toBe(false);
      }),
      { seed: SEED, numRuns: 30 },
    );
  });

  it('in json every line parses, has `kind`, and the last line has kind: "summary"', async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 0, max: 12 }), async (n) => {
        const r = await keel(["check", "--format=json"], { files: [...cleanProject(), ...dirtyProject(n)] });
        const recs = parseJsonLines(r.stdout);
        expect(recs.length).toBeGreaterThan(0);
        for (const rec of recs) expect(typeof rec.kind).toBe("string");
        expect(recs.at(-1)?.kind).toBe("summary");
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("exit code is 0 with no error diagnostics and 1 with error diagnostics", async () => {
    expect((await keel(["check"], { files: cleanProject() })).code).toBe(0);
    expect((await keel(["check"], { files: dirtyProject(1) })).code).toBe(1);
  });

  it("the same command run twice on the same input yields byte-identical output", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom("compact", "json", "pretty"), fc.integer({ min: 0, max: 8 }), async (fmt, n) => {
        const files = dirtyProject(n);
        const a = await keel(["check", `--format=${fmt}`], { files });
        const b = await keel(["check", `--format=${fmt}`], { files });
        expect(b).toEqual(a);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });
});
