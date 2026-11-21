// Spec: k.review, clause "Two runs on one fixture print byte-equal output, and a run with no network succeeds."
// Seed: n/a. Pending: `keel review` is not built.
// `keelRun` points every proxy variable at a closed port and gives git no network; the repository is local.
import { expect, test } from "vitest";
import { PROJECT, fixture, keelRun, range, review, withRepo } from "./review-support.ts";

test.skip("Two runs on one fixture print byte-equal output, and a run with no network succeeds.", () => {
  withRepo(
    [PROJECT, { "modules/m/c.test.ts": fixture("cast.ts"), "modules/m/i.ts": fixture("import-computed.ts") }],
    (repo) => {
      const r = range(repo, 0, 1);
      for (const args of [[r], [r, "--list"], ["--all"], ["--all", "--list"]]) {
        for (const format of ["json", "compact"] as const) {
          const a = keelRun(repo.dir, ["review", ...args], { format });
          const b = keelRun(repo.dir, ["review", ...args], { format });
          expect(a.stdout).not.toBe("");
          expect(b.stdout).toBe(a.stdout);
        }
      }
    },
  );
  withRepo([PROJECT, { "modules/m/a.ts": "export const a = 2;\n" }], (repo) => {
    const out = review(repo, [range(repo, 0, 1)]);
    expect(out.status).toBe(0);
    expect(keelRun(repo.dir, ["review", "--all"]).status).toBe(0);
  });
});
