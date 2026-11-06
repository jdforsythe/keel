// Spec: k.cli Rules E1052 unknown flag, or flag value invalid for the input schema.
// Note: the spec does not assign E1052 to an unknown `explain` code; that behavior is unspecified and untested.
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { SEED, cleanProject, keel, parseJsonLines } from "./fixtures";

describe("k.cli E1052", () => {
  it("E1052 unknown flag: any flag outside the accepted set yields E1052 with exit 2", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc
          .stringMatching(/^[a-z]{3,10}$/)
          .filter(
            (n) => !["format", "quiet", "limit", "verbose", "code", "for", "map", "props", "id", "diff"].includes(n),
          ),
        async (name) => {
          const r = await keel(["check", `--${name}`], { files: cleanProject() });
          expect(r.code).toBe(2);
          expect(r.stdout + r.stderr).toContain("E1052");
        },
      ),
      { seed: SEED, numRuns: 50 },
    );
  });

  it("E1052 flag value invalid for the input schema: --format=bogus and --limit with a non-number", async () => {
    for (const argv of [
      ["check", "--format=bogus"],
      ["check", "--limit", "abc"],
    ]) {
      const r = await keel(argv, { files: cleanProject() });
      expect(r.code).toBe(2);
      expect(r.stdout + r.stderr).toContain("E1052");
    }
  });

  it("usage errors (E105x) are diag records in json, not free text", async () => {
    const r = await keel(["check", "--zzz", "--format=json"], { files: cleanProject() });
    const recs = parseJsonLines(r.stdout);
    const d = recs.find((x) => x.kind === "diag");
    expect(d?.code).toBe("E1052");
    expect(typeof d?.message).toBe("string");
    expect(recs[recs.length - 1]?.kind).toBe("summary");
  });
});
