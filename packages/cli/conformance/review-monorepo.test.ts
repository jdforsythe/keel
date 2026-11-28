// Spec: k.review, clause "A review at a monorepo root and one of `apps/x` report the same findings for `apps/x`."
// Seed: n/a.
// A finding's `path` is relative to the git root in both runs (k.review Findings), so the two runs are compared whole,
// `path` and `id` included.
import { expect, test } from "vitest";
import { PROJECT, fixture, findings, range, review, withRepo } from "./review-support.ts";
import { join } from "node:path";

const app = (name: string, files: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries({ "topology.ts": PROJECT["topology.ts"] ?? "", ...files }).map(([p, t]) => [`apps/${name}/${p}`, t]),
  );

test("A review at a monorepo root and one of `apps/x` report the same findings for `apps/x`.", () => {
  const base = {
    "package.json": PROJECT["package.json"] ?? "",
    ...app("x", { "modules/m/a.ts": "export const a = 1;\n" }),
    ...app("y", { "modules/m/a.ts": "export const a = 1;\n" }),
  };
  const head = {
    ...app("x", { "modules/m/c.test.ts": fixture("cast.ts"), "modules/m/i.ts": fixture("import-computed.ts") }),
    ...app("y", { "modules/m/c.test.ts": fixture("cast.ts") }),
  };
  withRepo([base, head], (repo) => {
    const r = range(repo, 0, 1);
    const at = (cwd: string) =>
      findings(review(repo, [r, "--list"], cwd))
        .filter((f) => f.path.startsWith("apps/x/") || !f.path.startsWith("apps/"))
        .filter((f) => !["package.json"].includes(f.path))
        .map((f) => ({
          code: f.code,
          path: f.path,
          line: f.line,
          col: f.col,
          danger: f.danger,
          novelty: f.novelty,
          loud: f.loud,
          id: f.id,
        }));
    const key = (a: { code: string; path: string }, b: { code: string; path: string }): number =>
      a.code + a.path < b.code + b.path ? -1 : 1;
    const root = at(repo.dir).sort(key);
    expect(root.length).toBeGreaterThanOrEqual(2);
    expect(root.every((f) => f.path.startsWith("apps/x/"))).toBe(true);
    expect(at(join(repo.dir, "apps", "x")).sort(key)).toEqual(root);
    expect(findings(review(repo, [r], join(repo.dir, "apps", "x"))).some((f) => f.path.includes("apps/y"))).toBe(false);
  });
});
