// Spec: k.ledger-items, clause "In a folder holding `apps/a` whose `apps/a/reports/mutation/mutation.json` holds `modules/m/f.ts` with the tree's source and one Killed mutant, `keel ledger --write` stores a claim for `apps/a/modules/m/f.ts` and a `mutation.projects` entry `apps/a`; an `apps/a/mutation-justified.json` entry that justifies no mutant of that report is E1725."
// Spec: k.ledger-items, clause "Run in a project folder whose `reports/mutation/mutation.json` holds `modules/m/f.ts` with the tree's source and one Killed mutant, `keel ledger --write` stores a claim for `modules/m/f.ts` and a `mutation.projects` entry `.`."
// Pending (rfc:0235 step 5): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
// Seed: 1337 (the one property, 5 runs). Binary runs: 1 per case, 2 for the first (an app with and without a justification), 1 per property run. No report is written for a fixture (`reports: "none"`).
// The real `keel` binary over temp projects (OS tmpdir); the mutation report is hand-written JSON in Stryker's shape (ledger-fixture-kinds.ts); `--write out.json` is read back.
// ASSUMED: a claim's `file` for an app project is `apps/a/modules/m/f.ts`, as the clause says; a mutation report's keys are paths relative to its project, as Stryker writes them;
// `keel ledger` run with `--write` also reports W1733 for a project with a page route and no `reports/a11y.json`, whose path is `<project>/reports/a11y.json` (`reports/a11y.json` for `.`).
// k.ledger-items Projects names `examples/<e>` beside `packages` and `apps`: the clause list holds no case for it, so the case here follows the Projects paragraph.
import fc from "fast-check";
import { afterAll, describe, expect, it } from "vitest";
import { collect, mutantsOf, mutationReport, readJson, sha256 } from "./ledger-fixture-kinds.ts";
import { entry, justifiedFile, justifiedReport } from "./ledger-justified-fixture.ts";
import { source as clampSource } from "./ledger-fixture.ts";
import { SEED, SLOW, diagsOf, ledgerAsIs, packageJson } from "./ledger-items-support.ts";
import { type Run, keel, makeProject, removeProject } from "./test-sim-project.ts";

const THRESHOLDS = { high: 90, low: 80, break: 40 };
const F = "modules/m/f.ts";
const F_SOURCE = "export const f = (n: number): number => n + 1;\n";
const OUT = "out.json";
const ROUTES = `${JSON.stringify({ data: { r: { path: "/r" } }, hash: "fnv1a:00000000" })}\n`;
const RUN = (passed: boolean): string =>
  `${JSON.stringify([{ route: "r", component: null, rules: ["E1804"], violations: [], file: "modules/m/test/r.test.ts", test: "renders r", passed }], null, 2)}\n`;
const TEST_FILE = 'import { expect, it } from "vitest";\nit("holds", () => {\n  expect(1).toBe(1);\n});\n';

const made: string[] = [];
afterAll(() => {
  for (const d of made) removeProject(d);
});
const project = (prefix: string, files: Record<string, string>): string => {
  const dir = makeProject(prefix, files);
  made.push(dir);
  return dir;
};
const report = (key: string, source: string): string =>
  mutationReport({ [key]: { source, statuses: mutantsOf(1, 0) } }, THRESHOLDS);
const written = (dir: string): Record<string, unknown> => {
  const json = readJson(dir, OUT);
  return typeof json === "object" && json !== null ? Object.fromEntries(Object.entries(json)) : {};
};
const projectsOf = (dir: string): Record<string, unknown> => {
  const m = written(dir).mutation;
  const p = typeof m === "object" && m !== null ? Reflect.get(m, "projects") : undefined;
  return typeof p === "object" && p !== null ? Object.fromEntries(Object.entries(p)) : {};
};
const claimFiles = (dir: string): unknown[] =>
  collect(written(dir).mutation, ["file", "sha", "killed"]).map((c) => c.file);
const a11yRung = (dir: string, item: string): unknown =>
  collect(written(dir).a11y, ["item", "rung"]).find((x) => x.item === item)?.rung;

describe("k.ledger-items: a project is a folder whose tests and reports the ledger reads", () => {
  // Pending (rfc:0235 step 5): skipped until the build lands; the builder un-skips by changing each `it.skip` to `it` in this file.
  it.skip(
    "In a folder holding `apps/a` whose `apps/a/reports/mutation/mutation.json` holds `modules/m/f.ts` with the tree's source and one Killed mutant, `keel ledger --write` stores a claim for `apps/a/modules/m/f.ts` and a `mutation.projects` entry `apps/a`; an `apps/a/mutation-justified.json` entry that justifies no mutant of that report is E1725",
    () => {
      const dir = project("items-proj-app", {
        "apps/a/package.json": packageJson("a"),
        [`apps/a/${F}`]: F_SOURCE,
        "apps/a/reports/mutation/mutation.json": report(F, F_SOURCE),
      });
      const run = ledgerAsIs(dir, ["--write", OUT]);
      expect(run.status).toBe(0);
      expect(claimFiles(dir)).toEqual([`apps/a/${F}`]);
      expect(collect(written(dir).mutation, ["file", "sha"])[0]).toMatchObject({ sha: sha256(F_SOURCE) });
      expect(Object.keys(projectsOf(dir))).toEqual(["apps/a"]);
      expect(diagsOf(run, "E1725")).toEqual([]);

      // an entry whose texts match no mutant of the report on disk
      const stray = justifiedFile([entry({ file: F, original: "Math.min", replacement: "Math.max" })]);
      const bad = project("items-proj-app-e1725", {
        "apps/a/package.json": packageJson("a"),
        [`apps/a/${F}`]: F_SOURCE,
        "apps/a/reports/mutation/mutation.json": report(F, F_SOURCE),
        "apps/a/mutation-justified.json": stray,
      });
      expect(diagsOf(ledgerAsIs(bad), "E1725")).toHaveLength(1);
    },
    SLOW,
  );

  it.skip(
    "Run in a project folder whose `reports/mutation/mutation.json` holds `modules/m/f.ts` with the tree's source and one Killed mutant, `keel ledger --write` stores a claim for `modules/m/f.ts` and a `mutation.projects` entry `.`",
    () => {
      const dir = project("items-proj-dot", {
        [F]: F_SOURCE,
        "reports/mutation/mutation.json": report(F, F_SOURCE),
      });
      expect(ledgerAsIs(dir, ["--write", OUT]).status).toBe(0);
      expect(claimFiles(dir)).toEqual([F]);
      expect(Object.keys(projectsOf(dir))).toEqual(["."]);
    },
    SLOW,
  );

  it.skip(
    "a package is the project `packages/<p>`: its mutation is `mutation.projects['packages/p']`, its claims keep their path from the folder, and `mutation.packages` is gone",
    () => {
      const dir = project("items-proj-pkg", {
        "packages/p/package.json": packageJson("p"),
        "packages/p/src/f.ts": F_SOURCE,
        "packages/p/reports/mutation/mutation.json": report("src/f.ts", F_SOURCE),
      });
      expect(ledgerAsIs(dir, ["--write", OUT]).status).toBe(0);
      expect(Object.keys(projectsOf(dir))).toEqual(["packages/p"]);
      expect(claimFiles(dir)).toEqual(["packages/p/src/f.ts"]);
      const m = written(dir).mutation;
      expect(typeof m === "object" && m !== null ? Object.keys(m) : []).not.toContain("packages");
    },
    SLOW,
  );

  it.skip(
    "an app project's `mutation-justified.json` justifies the survivors of its own report: the claim holds `justified` 1 and the project's `scoreJustified` is above its `score`",
    () => {
      const key = "modules/m/clamp.ts";
      const mutated = justifiedReport("Survived", 1, THRESHOLDS).replace('"src/clamp.ts"', `"${key}"`);
      const dir = project("items-proj-justified", {
        "apps/a/package.json": packageJson("a"),
        [`apps/a/${key}`]: clampSource,
        "apps/a/reports/mutation/mutation.json": mutated,
        "apps/a/mutation-justified.json": justifiedFile([entry({ file: key })]),
      });
      expect(ledgerAsIs(dir, ["--write", OUT]).status).toBe(0);
      expect(collect(written(dir).mutation, ["file", "justified"])[0]).toMatchObject({
        file: `apps/a/${key}`,
        justified: 1,
      });
      const entryOf = collect(projectsOf(dir), ["score", "scoreJustified"])[0];
      expect(Number(entryOf?.scoreJustified)).toBeGreaterThan(Number(entryOf?.score));
    },
    SLOW,
  );

  it.skip(
    "a project's a11y items are `a11y:<project>:<routeId>#<criterion>` and rest on its own `reports/a11y.json`; with none, they are `none` and one W1733 is at `<project>/reports/a11y.json`",
    () => {
      const withReport = project("items-proj-a11y", {
        "apps/a/package.json": packageJson("a"),
        "apps/a/.keel/routes.json": ROUTES,
        "apps/a/reports/a11y.json": RUN(true),
      });
      const run = ledgerAsIs(withReport, ["--write", OUT]);
      expect(a11yRung(withReport, "a11y:apps/a:r#1.4.3")).toBe("example");
      expect(diagsOf(run, "W1733")).toEqual([]);

      const without = project("items-proj-a11y-none", {
        "apps/a/package.json": packageJson("a"),
        "apps/a/.keel/routes.json": ROUTES,
      });
      const bare = ledgerAsIs(without, ["--write", OUT]);
      expect(a11yRung(without, "a11y:apps/a:r#1.4.3")).toBe("none");
      expect(diagsOf(bare, "W1733")).toEqual([expect.objectContaining({ path: "apps/a/reports/a11y.json" })]);
    },
    SLOW,
  );

  it.skip(
    "an app outside a monorepo is the project `.`: its a11y items are `a11y:.:…`, its W1733 is at `reports/tests/` and `reports/a11y.json`",
    () => {
      const dir = project("items-proj-app-dot", {
        ".keel/routes.json": ROUTES,
        "test/r.test.ts": TEST_FILE,
      });
      const run = ledgerAsIs(dir, ["--write", OUT]);
      expect(a11yRung(dir, "a11y:.:r#1.4.3")).toBe("none");
      expect(
        diagsOf(run, "W1733")
          .map((d) => d.path)
          .sort(),
      ).toEqual(["reports/a11y.json", "reports/tests/"]);
    },
    SLOW,
  );

  it.skip(
    "an `examples/<e>` with a `package.json` is a project, named `examples/<e>`; one without is not, and an installed library is not a project of the app",
    () => {
      const dir = project("items-proj-examples", {
        "examples/e/package.json": packageJson("e"),
        "examples/e/test/x.test.ts": TEST_FILE,
        "examples/bare/test/x.test.ts": TEST_FILE,
        "node_modules/@acme/charts/package.json": `${JSON.stringify({ name: "@acme/charts", version: "0.1.0", keel: "library" })}\n`,
        "node_modules/@acme/charts/test/x.test.ts": TEST_FILE,
      });
      const run: Run = ledgerAsIs(dir);
      const paths = diagsOf(run, "W1733").map((d) => String(d.path));
      expect(paths).toEqual(["examples/e/reports/tests/"]);
      expect(Object.keys(projectsOf(dir))).toEqual([]);
    },
    SLOW,
  );

  it.skip(
    "a project with no test file the ledger reads has no W1733 for its tests",
    () => {
      const dir = project("items-proj-notests", { "packages/q/package.json": packageJson("q") });
      expect(diagsOf(ledgerAsIs(dir), "W1733")).toEqual([]);
    },
    SLOW,
  );

  it.skip("for any names, each `packages/<p>`, `apps/<a>` and `examples/<e>` with a `package.json` and a test file but no report is named by its path in one W1733 at `<path>/reports/tests/` (property)", () => {
    const name = fc.stringMatching(/^[a-z]{1,6}$/);
    const names = fc.uniqueArray(name, { minLength: 1, maxLength: 3 });
    fc.assert(
      fc.property(names, names, names, (ps, as, es) => {
        const paths = [
          ...ps.map((n) => `packages/${n}`),
          ...as.map((n) => `apps/${n}`),
          ...es.map((n) => `examples/${n}`),
        ];
        const files: Record<string, string> = {};
        for (const p of paths) {
          files[`${p}/package.json`] = packageJson("x");
          files[`${p}/test/x.test.ts`] = TEST_FILE;
        }
        const dir = project("items-proj-names", files);
        const found = diagsOf(keel(dir, ["ledger"], { reports: "none" }), "W1733").map((d) => String(d.path));
        expect(found.sort()).toEqual(paths.map((p) => `${p}/reports/tests/`).sort());
        removeProject(dir);
        made.splice(made.indexOf(dir), 1);
      }),
      { seed: SEED, numRuns: 5 },
    );
  }, 600_000);
});
