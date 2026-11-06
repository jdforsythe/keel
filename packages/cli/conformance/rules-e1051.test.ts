// Spec: k.cli, clause "`keel nope` emits E1051 and exits 2." and Rules E1051 unknown command.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { COMMANDS, SEED, keel, lines, parseJsonLines } from "./fixtures";

const known: readonly string[] = [...COMMANDS, "mcp", "lsp"];

describe("k.cli E1051", () => {
  it("`keel nope` emits E1051 and exits 2", async () => {
    const r = await keel(["nope"]);
    expect(r.code).toBe(2);
    expect(r.stdout + r.stderr).toContain("E1051");
  });

  it("E1051 unknown command: any name outside the command list yields E1051 with exit 2", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.stringMatching(/^[a-z][a-z0-9-]{0,11}$/).filter((n) => !known.includes(n) && n !== "session"),
        async (name) => {
          const r = await keel([name]);
          expect(r.code).toBe(2);
          expect(r.stdout + r.stderr).toContain("E1051");
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("E1051 is a diagnostic record in the output contract: json emits a diag line then a summary line", async () => {
    const r = await keel(["nope", "--format=json"]);
    const recs = parseJsonLines(r.stdout);
    expect(recs.some((d) => d.kind === "diag" && d.code === "E1051")).toBe(true);
    expect(recs[recs.length - 1]?.kind).toBe("summary");
  });

  it("E1051 in compact starts a line with the code (code, then message), not free text", async () => {
    const r = await keel(["nope", "--format=compact"]);
    expect(lines(r.stdout).some((l) => /^E1051 /.test(l))).toBe(true);
  });

  it("session is reserved for the stdlib sessions module; without it the kernel reports I1055 (info, exit 0)", async () => {
    const r = await keel(["session"]);
    expect(r.code).toBe(0);
    expect(r.stdout + r.stderr).toContain("I1055");
    expect(r.stdout + r.stderr).not.toContain("E1051");
  });
});
