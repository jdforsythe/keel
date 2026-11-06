// Spec: k.cli Conformance "With 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line; `--limit 2` prints 2."
// and OUTPUT.md: --quiet prints the trailer only; --code keeps only that code.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, dirtyProject, keel, lines } from "./fixtures";

const diagLines = (out: string): string[] => lines(out).filter((l) => /^E\d{4} /.test(l));
const files20 = dirtyProject(20);

describe("k.cli limit and quiet", () => {
  it("with 20 diagnostics of one code, compact prints 5 plus one `... +15 more` line", async () => {
    const r = await keel(["check", "--format=compact"], { files: files20 });
    expect(diagLines(r.stdout).filter((l) => l.startsWith("E1752"))).toHaveLength(5);
    const more = lines(r.stdout).filter((l) => l.startsWith("... +15 more"));
    expect(more).toHaveLength(1);
    expect(more[0]).toContain("E1752");
  });

  it("`--limit 2` prints 2", async () => {
    const r = await keel(["check", "--format=compact", "--limit", "2"], { files: files20 });
    expect(diagLines(r.stdout).filter((l) => l.startsWith("E1752"))).toHaveLength(2);
    expect(lines(r.stdout).some((l) => l.startsWith("... +18 more"))).toBe(true);
  });

  it("--limit N caps per code for any N: N printed and a `... +K more` line with K = 20 - N when N < 20", async () => {
    await fc.assert(
      fc.asyncProperty(fc.integer({ min: 1, max: 19 }), async (n) => {
        const r = await keel(["check", "--format=compact", "--limit", String(n)], { files: files20 });
        expect(diagLines(r.stdout)).toHaveLength(n);
        expect(lines(r.stdout).filter((l) => l.startsWith(`... +${20 - n} more`))).toHaveLength(1);
      }),
      { seed: SEED, numRuns: 20 },
    );
  });

  it("--quiet prints only the trailer: a single line that is the last line of the non-quiet output", async () => {
    const full = await keel(["check", "--format=compact"], { files: files20 });
    const q = await keel(["check", "--format=compact", "--quiet"], { files: files20 });
    expect(lines(q.stdout)).toHaveLength(1);
    expect(lines(full.stdout).at(-1)).toBe(lines(q.stdout)[0]);
    expect(q.stdout).not.toContain("E1752 ");
  });

  it("--code keeps only that code (the exit code still reflects all error diagnostics)", async () => {
    const r = await keel(["check", "--format=json", "--code", "E1751"], { files: files20 });
    expect(r.stdout).not.toContain('"code":"E1752"');
    expect(r.code).toBe(1);
  });
});
