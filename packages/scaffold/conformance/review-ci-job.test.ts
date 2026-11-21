// Spec: k.review, clause "The generated CI workflow holds a `review` job that runs `keel review` over the pull request's range."
// Seed: n/a. Pending: `keel review` and its CI job are not built.
// ASSUMED YAML: a job is a two-space-indented key under `jobs:` (as shell-target-ci reads it); `origin/<base_ref>` is the GitHub
// expression `${{ github.base_ref }}`; "on `pull_request`" is the job (or its `if`) naming `pull_request`; full history is `fetch-depth: 0`.
import { expect, test } from "vitest";
import { apply, read } from "./fixtures.ts";

test.skip("The generated CI workflow holds a `review` job that runs `keel review` over the pull request's range.", () => {
  const yml = read(apply("project", { name: "shop" }, new Map()).files, ".github/workflows/ci.yml");
  const lines = yml.split("\n");
  expect(lines.filter((l) => l === "  review:")).toHaveLength(1);
  const at = lines.indexOf("  review:");
  const end = lines.findIndex((l, i) => i > at && /^ {2}[^\s#]/.test(l));
  const job = lines.slice(at, end < 0 ? undefined : end).join("\n");
  expect(job).toContain("pull_request");
  expect(job).toContain("fetch-depth: 0");
  expect(job).toMatch(/install/);
  expect(job).toMatch(/keel review origin\/\$\{\{ github\.base_ref \}\}\.\.HEAD/);
});
