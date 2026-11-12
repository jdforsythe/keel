// Spec: std.multi, clause "Two users of one group get distinct `caller`s, and one user's `find` never returns the other's elements."
// Seed 1337
// Assumption: a user's caller is what the server read from that user's cookie jar, shown by `board.caller` after `board.refresh`.
import { openGroup } from "@keel/std-sessions/group";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { SEED, drive, groupOptions, texts } from "./group-fixtures.ts";

describe("std.multi: users are isolated", () => {
  test("Two users of one group get distinct `caller`s", async () => {
    const g = await openGroup(groupOptions(SEED));
    await drive(g, [
      { u: 0, do: "refresh" },
      { u: 1, do: "refresh" },
    ]);
    const [a0, a1] = await texts(g, "board.caller");
    await drive(g, [
      { u: 0, do: "refresh" },
      { u: 1, do: "refresh" },
    ]);
    const [b0, b1] = await texts(g, "board.caller");
    await g.stop();
    expect(a0).not.toBe("");
    expect(a1).not.toBe("");
    expect(a0).not.toBe(a1);
    // each user's own cookie jar keeps its caller across requests
    expect(b0).toBe(a0);
    expect(b1).toBe(a1);
  }, 60_000);

  test("one user's `find` never returns the other's elements", async () => {
    await fc.assert(
      fc.asyncProperty(fc.stringMatching(/^[a-z]{1,8}$/), fc.constantFrom<0 | 1>(0, 1), async (note, who) => {
        const g = await openGroup(groupOptions(SEED));
        await drive(g, [{ u: who, do: "note", v: note }]);
        const other = who === 0 ? 1 : 0;
        const mine = await g.user(who).find("board.local");
        const theirs = await g.user(other).find("board.local");
        const states = [await g.user(who).state(), await g.user(other).state()];
        await g.stop();
        expect(mine.text).toBe(note);
        expect(theirs.text).toBe("");
        expect(JSON.stringify(states[1])).not.toContain(note);
      }),
      { seed: 1337, numRuns: 4 },
    );
  }, 120_000);
});
