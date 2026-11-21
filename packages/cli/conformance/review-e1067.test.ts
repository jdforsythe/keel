// Spec: k.review, rule "E1067 `--accept` without `--reason`, a reason out of range, or an `id` with no finding"
// Seed: 1337 (reason lengths generated). Pending: `keel review` is not built.
// ASSUMED: exit 2, one `diag` E1067, `keel-review.json` neither created nor changed; a reason is 10 to 200 characters.
import { existsSync } from "node:fs";
import { join } from "node:path";
import fc from "fast-check";
import { expect, test } from "vitest";
import { PROJECT, SEED, fixture, ofCode, review, withRepo } from "./review-support.ts";

test.skip("E1067 `--accept` without `--reason`, a reason out of range, or an `id` with no finding", () => {
  withRepo([{ ...PROJECT, "modules/m/c.test.ts": fixture("cast.ts") }], (repo) => {
    const id = ofCode(review(repo, ["--all"]), "R1050")[0]?.id ?? "";
    const file = join(repo.dir, "keel-review.json");
    const refused = (args: string[]): void => {
      const out = review(repo, args);
      expect(
        out.records.filter((r) => r.kind === "diag").map((r) => r.code),
        args.join(" "),
      ).toEqual(["E1067"]);
      expect(out.status).toBe(2);
      expect(existsSync(file)).toBe(false);
    };
    refused(["--accept", id]);
    refused(["--accept", "ffffffffffff", "--reason", "a reason long enough"]);
    fc.assert(
      fc.property(fc.oneof(fc.integer({ min: 0, max: 9 }), fc.integer({ min: 201, max: 260 })), (n) => {
        refused(["--accept", id, "--reason", "r".repeat(n)]);
      }),
      { seed: SEED, numRuns: 6 },
    );
  });
});
