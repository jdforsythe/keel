// Spec: k.review, clause "Compact prints no `list` finding without `--list`; json holds every `fail`, `warn` and `list` finding, and `count` ones with `--list`; the trailer counts all four."
// Seed: n/a (one fixture). Pending: `keel review` is not built.
// Fixture: <base> holds an accepted R1050 (its id read off a probe run) in `modules/m/acc.test.ts`; <head> adds a `fail` (R1053),
// a `warn` (a new R1050 cast) and a `list` (R1001, an opt-in) finding. ASSUMED: compact trailer `fail review 1 fail, 1 warn,
// 1 listed, 1 accepted` (k.review Trailer); json `summary.counts` is `{ fail, warn, list, accepted }`.
import { expect, test } from "vitest";
import {
  PROJECT,
  baselineText,
  counts,
  findings,
  fixture,
  keelRun,
  ofCode,
  range,
  review,
  withRepo,
} from "./review-support.ts";

const ACC = { "modules/m/acc.test.ts": fixture("cast.ts") };
const HEAD = {
  "modules/m/i.ts": fixture("import-computed.ts"),
  "modules/m/c.test.ts": fixture("cast.ts"),
  "modules/m/u.ts": 'import { unsafe } from "@keel/ctx";\nexport const v = unsafe("a reason long enough", () => 1);\n',
};

test.skip("Compact prints no `list` finding without `--list`; json holds every `fail`, `warn` and `list` finding, and `count` ones with `--list`; the trailer counts all four.", () => {
  const id = withRepo([PROJECT, ACC], (repo) => ofCode(review(repo, [range(repo, 0, 1)]), "R1050")[0]?.id ?? "");
  const entry = [{ id, code: "R1050", path: "modules/m/acc.test.ts", reason: "accepted for the fixture" }];
  withRepo([{ ...PROJECT, ...ACC, "keel-review.json": baselineText(entry) }, HEAD], (repo) => {
    const r = range(repo, 0, 1);
    const compact = keelRun(repo.dir, ["review", r], { format: "compact" });
    expect(compact.status).toBe(1);
    expect(compact.stdout).toContain("R1053 modules/m/i.ts");
    expect(compact.stdout).toContain("R1050 modules/m/c.test.ts");
    expect(compact.stdout).not.toContain("modules/m/u.ts");
    expect(compact.stdout).not.toContain("modules/m/acc.test.ts");
    expect(compact.stdout.trimEnd().split("\n").at(-1)).toBe("fail review 1 fail, 1 warn, 1 listed, 1 accepted");
    expect(keelRun(repo.dir, ["review", r, "--list"], { format: "compact" }).stdout).toContain("R1001 modules/m/u.ts");

    const json = review(repo, [r]);
    expect(
      findings(json)
        .map((f) => f.loud)
        .sort(),
    ).toEqual(["fail", "list", "warn"]);
    expect(counts(json)).toEqual({ fail: 1, warn: 1, list: 1, accepted: 1 });
    const listed = review(repo, [r, "--list"]);
    expect(
      findings(listed)
        .map((f) => f.loud)
        .sort(),
    ).toEqual(["count", "fail", "list", "warn"]);
    expect(counts(listed)).toEqual({ fail: 1, warn: 1, list: 1, accepted: 1 });
  });
});
