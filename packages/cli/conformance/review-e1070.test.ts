// Spec: k.review, rule "E1070 `keel-review.json` does not parse, or holds an `id` twice"
// Seed: n/a.
// ASSUMED: exit 2, one `diag` E1070; the file is read at `<base>` for a range and from the working tree for `--all`.
import { expect, test } from "vitest";
import { PROJECT, baselineText, range, review, withRepo } from "./review-support.ts";

const entry = (id: string): { id: string; code: string; path: string; reason: string } => ({
  id,
  code: "R1050",
  path: "modules/m/a.ts",
  reason: "accepted for the fixture",
});
const BAD = ["{ not json", "", baselineText([entry("0123456789ab"), entry("0123456789ab")])];

test("E1070 `keel-review.json` does not parse, or holds an `id` twice", () => {
  for (const text of BAD) {
    withRepo([{ ...PROJECT, "keel-review.json": text }, { "modules/m/a.ts": "export const a = 2;\n" }], (repo) => {
      for (const args of [[range(repo, 0, 1)], ["--all"]]) {
        const out = review(repo, args);
        expect(
          out.records.filter((r) => r.kind === "diag").map((r) => r.code),
          text,
        ).toEqual(["E1070"]);
        expect(out.status).toBe(2);
      }
    });
  }
  withRepo(
    [{ ...PROJECT, "keel-review.json": baselineText([entry("0123456789ab"), entry("ba9876543210")]) }],
    (repo) => {
      expect(review(repo, ["--all"]).records.some((r) => r.kind === "diag" && r.code === "E1070")).toBe(false);
    },
  );
});
