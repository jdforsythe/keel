// `--user <id>` (std.sessions Commands): an id that starts with `-` is a bad value, E1052, as a mistyped flag would be.
// Seed 1337
import { run } from "@keel/cli";
import "../../src/tools.ts";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { UserArg } from "../../src/internal/UserArg.ts";

describe("UserArg", () => {
  test("accepts a non-empty id and refuses an empty one or one starting with -", () => {
    fc.assert(
      fc.property(fc.string({ minLength: 1 }), (v) => {
        expect(UserArg.parse(v).ok).toBe(!v.startsWith("-"));
      }),
      { seed: 1337, numRuns: 100 },
    );
    expect(UserArg.parse("").ok).toBe(false);
  });
  test("keel session replay --user -x is E1052 with exit 2, and so is --user=-x", async () => {
    for (const args of [["--user", "-x"], ["--user=-x"]]) {
      const r = await run(["session", "replay", "s.json", ...args], { cwd: "/nowhere", files: [] });
      expect(r.code, r.stdout).toBe(2);
      expect(r.stdout).toContain('E1052 --user value "-x" invalid');
    }
  });
});
