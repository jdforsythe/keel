// Spec: k.ledger, Conformance "In a project whose `.keel/routes.json` lists page route `r` (`path: '/r'`) and which has no `reports/a11y.json`, `keel ledger --write tooling/ledger/ledger.json` run in the project over a `tooling/ledger/ledger.json` whose `a11y` holds `a11y:.:r#1.4.3` at `example` writes `a11y:.:r#1.4.3` at `example`, its summary `counts` hold `keptNoReport: 1` and its compact trailer ends `, 1 keptNoReport`; over one whose `a11y` lacks `a11y:.:r#1.4.3` it writes it at `none` and the `counts` hold no `keptNoReport`."
// Spec: k.ledger, Conformance "The same project with a `reports/a11y.json` holding one failed run of `r` whose `violations` hold a rule mapped to 1.4.3: `keel ledger --write` over the ledger holding `a11y:.:r#1.4.3` at `example` writes it at `none` and its `counts` hold no `keptNoReport`, and `keel ledger --diff` against that ledger reports E1706; with that run passed and its `violations` empty, `--write` writes it at `example`."
// Spec: k.ledger, clause "Over a ledger whose `a11y` also holds `a11y:.:gone#1.4.3` and `a11y:r#1.4.3` at `example`, with `gone` not in `.keel/routes.json`, `keel ledger --write` writes neither item, with and without `reports/a11y.json`."
// Spec: k.ledger, clause "From a committed claim for `packages/a/src/a.ts` whose `sha` the file no longer hashes to, and a report on disk whose `files` hold `src/a.ts` with the tree's source and only `Ignored` mutants, `keel ledger --write` stores no claim for `packages/a/src/a.ts` and `keel ledger --diff` reports no W1714; with one `Killed` mutant in place of the `Ignored` one it stores a claim for it whose `sha` is the file's, and `--diff` reports no W1714."
// Seed: 1337 (no property: fixed projects, the real `keel` binary over temp projects in the OS tmpdir).
// ASSUMPTIONS: the committed ledger is first written by `keel ledger --write` over the bare project, then its `a11y` list is edited (an array of `{ item, rung }`, as tooling/ledger/ledger.json holds it); `.keel/routes.json` is `{ data: { r: { path: "/r" } }, hash }` (a page route: a non-null `path`, no `api: true`);
// an `A11yRun` is `{ route, component, rules, violations: [{ rule, element }], file, test, passed }`; `E1804` is the rule mapped to 1.4.3; `--diff` reads the committed ledger at tooling/ledger/ledger.json.
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { collect, diags, mutantsOf, mutationReport, sha256 } from "./ledger-fixture-kinds.ts";
import {
  type CliRecord,
  type Run,
  keel,
  makeProject,
  removeProject,
  root,
  summaryOf,
  writeFiles,
} from "./test-sim-project.ts";

const COMMITTED = "tooling/ledger/ledger.json";
const ITEM = "a11y:.:r#1.4.3";
const GONE = "a11y:.:gone#1.4.3";
// the item form without a project: no current key is this, so `--write` drops it
const OLD = "a11y:r#1.4.3";
const ROUTES = `${JSON.stringify({ data: { r: { path: "/r" } }, hash: "fnv1a:00000000" })}\n`;
const run = (passed: boolean, violations: readonly { rule: string; element: string }[]) =>
  `${JSON.stringify([{ route: "r", component: null, rules: ["E1804"], violations, file: "modules/m/test/r.test.ts", test: "renders r", passed }], null, 2)}\n`;
const FAILED = run(false, [{ rule: "E1804", element: "r.msg" }]);
const PASSED = run(true, []);

const created: string[] = [];
afterEach(() => {
  for (const d of created.splice(0)) removeProject(d);
});
const project = (prefix: string, files: Readonly<Record<string, string>>): string => {
  const dir = makeProject(prefix, files);
  created.push(dir);
  return dir;
};
const readLedger = (dir: string): unknown => JSON.parse(readFileSync(join(dir, COMMITTED), "utf8"));
const rungOf = (dir: string, item: string): unknown =>
  collect(readLedger(dir), ["item", "rung"]).find((x) => x.item === item)?.rung;
const countsOf = (r: Run): Record<string, unknown> => {
  const c = summaryOf(r)?.counts;
  return typeof c === "object" && c !== null ? Object.fromEntries(Object.entries(c)) : {};
};

/** Writes the ledger over the bare project, then sets its `a11y` list to `items`. */
function commit(dir: string, items: readonly { item: string; rung: string }[]): void {
  const first = keel(dir, ["ledger", "--write", COMMITTED]);
  if (first.status !== 0) throw new Error(`keel ledger --write failed: ${first.stdout}`);
  const led = readLedger(dir);
  if (typeof led !== "object" || led === null) throw new Error("ledger is not an object");
  writeFiles(dir, { [COMMITTED]: `${JSON.stringify({ ...led, a11y: items }, null, 2)}\n` });
}
const compactLine = (dir: string, args: readonly string[]): string => {
  const env: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (v === undefined || k.startsWith("VITEST") || k.startsWith("KEEL_")) continue;
    if (k === "NODE_OPTIONS" || k === "TEST" || k === "NODE_ENV") continue;
    env[k] = v;
  }
  const r = spawnSync(process.execPath, [join(root, "packages", "cli", "src", "bin.ts"), ...args, "--format=compact"], {
    cwd: dir,
    encoding: "utf8",
    env,
  });
  return r.stdout.trimEnd().split("\n").at(-1) ?? "";
};

describe("k.ledger: kept a11y claims and the unscored mutation file", () => {
  it("with no `reports/a11y.json`, `a11y:.:r#1.4.3` stays at `example`, `counts` hold `keptNoReport: 1` and the compact trailer ends `, 1 keptNoReport`; over a ledger lacking it, it is `none` with no `keptNoReport`", () => {
    const dir = project("ledger-kept", { ".keel/routes.json": ROUTES });
    commit(dir, [{ item: ITEM, rung: "example" }]);
    const kept = keel(dir, ["ledger", "--write", COMMITTED]);
    expect(kept.status).toBe(0);
    expect(rungOf(dir, ITEM)).toBe("example");
    expect(countsOf(kept)).toMatchObject({ keptNoReport: 1 });
    commit(dir, [{ item: ITEM, rung: "example" }]);
    expect(compactLine(dir, ["ledger", "--write", COMMITTED])).toMatch(/, 1 keptNoReport$/);

    commit(dir, []);
    const lacking = keel(dir, ["ledger", "--write", COMMITTED]);
    expect(rungOf(dir, ITEM)).toBe("none");
    expect(countsOf(lacking)).not.toHaveProperty("keptNoReport");
  }, 60_000);

  it("with a `reports/a11y.json` holding one failed run of `r` with an E1804 violation, `--write` writes `a11y:.:r#1.4.3` at `none`, no `keptNoReport`, and `--diff` reports E1706; with the run passed and no violations it is `example`", () => {
    const dir = project("ledger-recomputed", { ".keel/routes.json": ROUTES, "reports/a11y.json": FAILED });
    commit(dir, [{ item: ITEM, rung: "example" }]);
    const diff = keel(dir, ["ledger", "--diff"]);
    expect(diags(diff, "E1706").length).toBeGreaterThan(0);
    const written = keel(dir, ["ledger", "--write", COMMITTED]);
    expect(rungOf(dir, ITEM)).toBe("none");
    expect(countsOf(written)).not.toHaveProperty("keptNoReport");

    writeFiles(dir, { "reports/a11y.json": PASSED });
    commit(dir, [{ item: ITEM, rung: "example" }]);
    keel(dir, ["ledger", "--write", COMMITTED]);
    expect(rungOf(dir, ITEM)).toBe("example");
  }, 60_000);

  it("`a11y:.:gone#1.4.3` for a route not in `.keel/routes.json` and the old-form `a11y:r#1.4.3` are not written, with and without `reports/a11y.json`", () => {
    for (const report of [undefined, FAILED, PASSED]) {
      const dir = project("ledger-gone", {
        ".keel/routes.json": ROUTES,
        ...(report === undefined ? {} : { "reports/a11y.json": report }),
      });
      commit(dir, [
        { item: ITEM, rung: "example" },
        { item: GONE, rung: "example" },
        { item: OLD, rung: "example" },
      ]);
      keel(dir, ["ledger", "--write", COMMITTED]);
      expect(collect(readLedger(dir), ["item", "rung"]).map((x) => x.item)).not.toContain(GONE);
      expect(collect(readLedger(dir), ["item", "rung"]).map((x) => x.item)).not.toContain(OLD);
    }
  }, 120_000);

  const A = "packages/a/src/a.ts";
  const REPORT = "packages/a/reports/mutation/mutation.json";
  const a1 = "export const a = (n: number): number => n + 1;\n";
  const a2 = `${a1}// edited after the committed claim\n`;
  const reportOf = (statuses: ReturnType<typeof mutantsOf>, source: string): string =>
    mutationReport({ "src/a.ts": { source, statuses } }, { high: 90, low: 80, break: 40 });
  const ignored = (statuses: ReturnType<typeof mutantsOf>, source: string): string =>
    reportOf(statuses, source).replaceAll('"Killed"', '"Ignored"');
  const claimsOf = (dir: string) => collect(readLedger(dir), ["file", "sha", "killed"]).filter((c) => c.file === A);

  it("a stale committed claim and a report holding only `Ignored` mutants for the tree's source: `--write` stores no claim and `--diff` reports no W1714; with one `Killed` mutant it stores a claim with the file's `sha`, and no W1714", () => {
    const dir = project("ledger-ignored", { [A]: a1, [REPORT]: reportOf(mutantsOf(1, 0), a1) });
    expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
    expect(claimsOf(dir)).toHaveLength(1);
    const committed = readFileSync(join(dir, COMMITTED), "utf8");

    writeFiles(dir, { [A]: a2, [REPORT]: ignored(mutantsOf(1, 0), a2) });
    expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
    expect(claimsOf(dir)).toEqual([]);
    writeFiles(dir, { [COMMITTED]: committed });
    expect(diags(keel(dir, ["ledger", "--diff"]), "W1714")).toEqual([]);

    writeFiles(dir, { [COMMITTED]: committed, [REPORT]: reportOf(mutantsOf(1, 0), a2) });
    expect(keel(dir, ["ledger", "--write", COMMITTED]).status).toBe(0);
    expect(claimsOf(dir)).toEqual([expect.objectContaining({ file: A, sha: sha256(a2) })]);
    expect(diags(keel(dir, ["ledger", "--diff"]), "W1714")).toEqual([]);
  }, 120_000);
});
