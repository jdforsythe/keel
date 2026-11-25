// k.cli, "Commands" table. Every listed command is accepted by `run` (never E1051).
import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { COMMANDS, SEED, cleanProject, keel } from "./fixtures";

describe("k.cli commands", () => {
  it("every command in the Commands table is accepted by run and is not reported as E1051", async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(...COMMANDS), async (cmd) => {
        const r = await keel([cmd], { files: cleanProject() });
        expect(r.stdout + r.stderr).not.toContain("E1051");
      }),
      { seed: SEED, numRuns: COMMANDS.length * 2 },
    );
  });

  it("every command accepts --format, --quiet, --limit N and --verbose without E1052", async () => {
    for (const cmd of COMMANDS) {
      for (const flags of [
        ["--format=json"],
        ["--format=compact"],
        ["--format=pretty"],
        ["--quiet"],
        ["--limit", "3"],
        ["--verbose"],
      ]) {
        const r = await keel([cmd, ...flags], { files: cleanProject() });
        expect(r.stdout + r.stderr).not.toContain("E1052");
      }
    }
  });
});
