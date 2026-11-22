// Spec: k.escapes, clause "A file kept by the range with one `.pii(` call fewer is one R1108."
// Seed: n/a.
import { expect, test } from "vitest";
import { PROJECT, ofCode, range, review, withRepo } from "./review-support.ts";

const file = (n: number): string =>
  `export const f = [${Array.from({ length: n }, (_, i) => `s.string().pii("k${i}")`).join(", ")}];\n`;

test("A file kept by the range with one `.pii(` call fewer is one R1108.", () => {
  withRepo([{ ...PROJECT, "modules/m/s.ts": file(3) }, { "modules/m/s.ts": file(2) }], (repo) => {
    const hits = ofCode(review(repo, [range(repo, 0, 1)]), "R1108");
    expect(hits).toHaveLength(1);
    expect(hits[0]?.path).toBe("modules/m/s.ts");
    expect(hits[0]?.danger).toBe("high");
  });
  withRepo(
    [
      { ...PROJECT, "modules/m/s.ts": file(2) },
      { "modules/m/s.ts": file(2), "modules/m/a.ts": "export const a = 2;\n" },
    ],
    (repo) => {
      expect(ofCode(review(repo, [range(repo, 0, 1), "--list"]), "R1108")).toEqual([]);
    },
  );
});
