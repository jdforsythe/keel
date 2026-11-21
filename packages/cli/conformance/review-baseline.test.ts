// Spec: k.review, clause "With its `id` in `keel-review.json` at `<base>` a finding is `accepted` and counted only; the same entry added only at `<head>` leaves it `new` and adds one R1105."
// Seed: n/a (examples). Pending: `keel review` is not built.
// ASSUMED: json `summary.counts` is `{ fail, warn, list, accepted }`; an accepted finding is a `review` record with
// `loud: "count"` and `novelty: "accepted"`, printed in json only with `--list`.
import { expect, test } from "vitest";
import { PROJECT, baselineText, counts, fixture, ofCode, range, review, withRepo } from "./review-support.ts";

const CAST = { "modules/m/c.test.ts": fixture("cast.ts") };
const REASON = "accepted for the fixture";

test.skip("With its `id` in `keel-review.json` at `<base>` a finding is `accepted` and counted only; the same entry added only at `<head>` leaves it `new` and adds one R1105.", () => {
  // The id is read off a run where the finding is new.
  const id = withRepo([PROJECT, CAST], (repo) => ofCode(review(repo, [range(repo, 0, 1)]), "R1050")[0]?.id ?? "");
  expect(id).toMatch(/^[0-9a-f]{12}$/);
  const entry = [{ id, code: "R1050", path: "modules/m/c.test.ts", reason: REASON }];

  // Accepted at <base>: the finding stands in the range and is only counted.
  withRepo(
    [{ ...PROJECT, ...CAST, "keel-review.json": baselineText(entry) }, { "modules/m/a.ts": "export const a = 2;\n" }],
    (repo) => {
      const r = range(repo, 0, 1);
      const plain = review(repo, [r]);
      expect(ofCode(plain, "R1050")).toEqual([]);
      expect(plain.status).toBe(0);
      expect(counts(plain)?.accepted).toBe(1);
      const listed = ofCode(review(repo, [r, "--list"]), "R1050");
      expect(listed).toHaveLength(1);
      expect(listed[0]?.novelty).toBe("accepted");
      expect(listed[0]?.loud).toBe("count");
    },
  );

  // The entry added only at <head>: the finding (also new at <head>) stays new and loud; one R1105.
  withRepo([PROJECT, { ...CAST, "keel-review.json": baselineText(entry) }], (repo) => {
    const out = review(repo, [range(repo, 0, 1)]);
    const cast = ofCode(out, "R1050");
    expect(cast).toHaveLength(1);
    expect(cast[0]?.novelty).toBe("new");
    expect(cast[0]?.loud).not.toBe("count");
    expect(ofCode(out, "R1105")).toHaveLength(1);
    expect(counts(out)?.accepted).toBe(0);
  });

  // Once the entry is in <base>, the next range counts the finding as accepted.
  withRepo(
    [PROJECT, { ...CAST, "keel-review.json": baselineText(entry) }, { "modules/m/a.ts": "export const a = 3;\n" }],
    (repo) => {
      const later = ofCode(review(repo, [range(repo, 1, 2)]), "R1050");
      expect(later).toEqual([]);
      expect(counts(review(repo, [range(repo, 1, 2)]))?.accepted).toBe(1);
    },
  );
});
