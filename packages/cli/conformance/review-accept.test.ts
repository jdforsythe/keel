// Spec: k.review, clause "`--accept <id> --reason <text>` writes one entry; without `--reason`, E1067 and nothing written; a range outside git, E1069."
// Seed: n/a.
// ASSUMED: a usage error is a `diag` record with the code and exit 2 (k.cli Output: "2 usage error"); `--accept` writes
// `keel-review.json` beside `topology.ts` (here the git root) with two-space indents as `{ v: 1, accepted: [{ id, code, path, reason }] }`.
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { PROJECT, fixture, keelRun, ofCode, review, withRepo } from "./review-support.ts";

const REASON = "accepted for the fixture";
const diag = (out: { records: { kind: string; code?: unknown }[] }, code: string): number =>
  out.records.filter((r) => r.kind === "diag" && r.code === code).length;

test("`--accept <id> --reason <text>` writes one entry; without `--reason`, E1067 and nothing written; a range outside git, E1069.", () => {
  withRepo([{ ...PROJECT, "modules/m/c.test.ts": fixture("cast.ts") }], (repo) => {
    const found = ofCode(review(repo, ["--all"]), "R1050");
    expect(found).toHaveLength(1);
    const id = found[0]?.id ?? "";
    const file = join(repo.dir, "keel-review.json");

    const bare = review(repo, ["--accept", id]);
    expect(diag(bare, "E1067")).toBe(1);
    expect(bare.status).toBe(2);
    expect(existsSync(file)).toBe(false);

    const ok = review(repo, ["--accept", id, "--reason", REASON]);
    expect(ok.status).toBe(0);
    expect(JSON.parse(readFileSync(file, "utf8"))).toEqual({
      v: 1,
      accepted: [{ id, code: "R1050", path: "modules/m/c.test.ts", reason: REASON }],
    });
    expect(ofCode(review(repo, ["--all", "--list"]), "R1050")[0]?.novelty).toBe("accepted");
  });
  const outside = mkdtempSync(join(tmpdir(), "keel-review-nogit-"));
  try {
    const out = keelRun(outside, ["review", "main..HEAD"]);
    expect(diag(out, "E1069")).toBe(1);
    expect(out.status).toBe(2);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
});
