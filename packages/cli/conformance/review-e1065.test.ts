// Spec: k.review, rule "E1065 not a git repository, or a revision of the range does not resolve"
// Seed: n/a. Pending: `keel review` is not built.
// ASSUMED: a usage error is one `diag` record with its code and exit 2 (k.cli Output); the message text is not asserted.
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vitest";
import { PROJECT, keelRun, review, withRepo } from "./review-support.ts";

const codes = (out: { records: { kind: string; code?: unknown }[] }): unknown[] =>
  out.records.filter((r) => r.kind === "diag").map((r) => r.code);

test.skip("E1065 not a git repository, or a revision of the range does not resolve", () => {
  const outside = mkdtempSync(join(tmpdir(), "keel-review-nogit-"));
  try {
    const out = keelRun(outside, ["review", "main..HEAD"]);
    expect(codes(out)).toEqual(["E1065"]);
    expect(out.status).toBe(2);
  } finally {
    rmSync(outside, { recursive: true, force: true });
  }
  withRepo([PROJECT], (repo) => {
    for (const r of ["nosuchrev..HEAD", "HEAD..nosuchrev"]) {
      const out = review(repo, [r]);
      expect(codes(out), r).toEqual(["E1065"]);
      expect(out.status).toBe(2);
    }
  });
});
