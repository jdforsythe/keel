// Spec: std.multi, clause "Under one seed, two runs of one script on `openGroup` give byte-equal groups."
// Seed 1337
import { openGroup } from "@keel/std-sessions/group";
import fc from "fast-check";
import { describe, expect, test } from "vitest";
import { GROUP_BOUND, SEED, type Step, drive, groupOptions } from "./group-fixtures.ts";

const word = fc.stringMatching(/^[a-z]{1,6}$/);
const user = fc.constantFrom<0 | 1>(0, 1);
const stepArb: fc.Arbitrary<Step> = fc.oneof(
  fc.tuple(user, word).map(([u, v]): Step => ({ u, do: "note", v })),
  fc
    .tuple(user, fc.constantFrom<"refresh" | "write" | "rename" | "probe">("refresh", "write", "rename", "probe"))
    .map(([u, d]): Step => ({ u, do: d })),
  fc.tuple(user, fc.boolean()).map(([u, b]): Step => ({ u, do: "online", b })),
  fc.integer({ min: 1, max: 400 }).map((advance): Step => ({ advance })),
);

async function run(seed: number, script: readonly Step[]): Promise<string> {
  const g = await openGroup(groupOptions(seed));
  await drive(g, script);
  return JSON.stringify(await g.stop());
}

/** Generated scripts the case runs: two groups a run. */
const RUNS = 5;

describe("std.multi: openGroup is deterministic", () => {
  test("Under one seed, two runs of one script on `openGroup` give byte-equal groups", async () => {
    // Workers make runs slow: few runs, each a pair of full group recordings.
    await fc.assert(
      fc.asyncProperty(fc.array(stepArb, { maxLength: 8 }), async (script) => {
        const a = await run(SEED, script);
        const b = await run(SEED, script);
        expect(a).toBe(b);
      }),
      { seed: 1337, numRuns: RUNS },
    );
  }, RUNS * 2 * GROUP_BOUND);
});
