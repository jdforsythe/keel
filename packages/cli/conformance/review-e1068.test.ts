// Spec: k.review, rule "E1068 a range with `--all`"
// Seed: n/a.
// ASSUMED: exit 2 and one `diag` E1068, whichever order the two are given.
import { expect, test } from "vitest";
import { PROJECT, range, review, withRepo } from "./review-support.ts";

test("E1068 a range with `--all`", () => {
  withRepo([PROJECT, { "modules/m/a.ts": "export const a = 2;\n" }], (repo) => {
    const r = range(repo, 0, 1);
    for (const args of [
      [r, "--all"],
      ["--all", r],
    ]) {
      const out = review(repo, args);
      expect(
        out.records.filter((x) => x.kind === "diag").map((x) => x.code),
        args.join(" "),
      ).toEqual(["E1068"]);
      expect(out.status).toBe(2);
    }
  });
});
