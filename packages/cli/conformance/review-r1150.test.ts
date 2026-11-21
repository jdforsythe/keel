// Spec: k.escapes, clause "A tracked `.ts` file that does not parse is one R1150, and the other findings still print."
// Seed: n/a. Pending: `keel review` is not built.
import { expect, test } from "vitest";
import { PROJECT, fixture, ofCode, range, review, withRepo } from "./review-support.ts";

test("A tracked `.ts` file that does not parse is one R1150, and the other findings still print.", () => {
  withRepo(
    [PROJECT, { "modules/m/bad.ts": "export const = ;\n", "modules/m/c.test.ts": fixture("cast.ts") }],
    (repo) => {
      const out = review(repo, [range(repo, 0, 1)]);
      const bad = ofCode(out, "R1150");
      expect(bad).toHaveLength(1);
      expect(bad[0]?.path).toBe("modules/m/bad.ts");
      expect(ofCode(out, "R1050")).toHaveLength(1);
      expect(out.status).toBe(1);
    },
  );
});
