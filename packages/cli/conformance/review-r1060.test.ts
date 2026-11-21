// Spec: k.escapes, clause "A test file losing one `expect` call between `<base>` and `<head>` is one R1060; a test file renamed unchanged is none."
// Seed: n/a. Pending: `keel review` is not built. A rename is a delete and an add of the same bytes (git follows it).
import { expect, test } from "vitest";
import { PROJECT, fixture, ofCode, range, review, withRepo } from "./review-support.ts";

test("A test file losing one `expect` call between `<base>` and `<head>` is one R1060; a test file renamed unchanged is none.", () => {
  const two = fixture("test-two-expects.ts");
  withRepo(
    [{ ...PROJECT, "modules/m/t.test.ts": two }, { "modules/m/t.test.ts": fixture("test-plain.ts") }],
    (repo) => {
      const hits = ofCode(review(repo, [range(repo, 0, 1)]), "R1060");
      expect(hits).toHaveLength(1);
      expect(hits[0]?.path).toBe("modules/m/t.test.ts");
    },
  );
  withRepo(
    [
      { ...PROJECT, "modules/m/t.test.ts": two },
      { "modules/m/t.test.ts": null, "modules/m/u.test.ts": two },
    ],
    (repo) => {
      expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1060")).toEqual([]);
    },
  );
});
