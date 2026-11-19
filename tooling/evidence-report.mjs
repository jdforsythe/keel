// Writes tooling/ledger/evidence.json: the ledger's totals by section and rung, static test counts per unit,
// mutation per unit and line and branch coverage per unit (tooling/evidence.mjs has the shape and counting rules).
// Usage: pnpm evidence:report             write evidence.json; refuses (S0010) while a spec section, unit manifest or
//                                         test file differs from HEAD
//        pnpm evidence:report --allow-dirty  write anyway and record the differing paths under `dirty`
//        pnpm evidence:report --check     exit 2 with S0007 when a compared part differs from a fresh count
//        pnpm evidence:report --markdown  write evidence.json, then tasks/COVERAGE.md from it
// Mutation and coverage are measured by runs (pnpm mutate, pnpm coverage); a unit with no local measurement keeps
// the committed file's entry. --check always compares the ledger, the tests and the mutation numbers the ledger
// decides; it compares a unit's coverage and mutation report date only when that unit's measurement file is on disk,
// and counts the units it left out as notCoverage and notMutationReports.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderMarkdown } from "./evidence-markdown.mjs";
import { buildReport, checkedParts, dirtyInputs, notChecked, presentInputs, stableJson, units } from "./evidence.mjs";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const OUT = "tooling/ledger/evidence.json";
const MD = "tasks/COVERAGE.md";
const args = parseArgs();
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

await run("evidence-report", () => {
  const previous = fs.existsSync(path.join(root, OUT)) ? read(OUT) : undefined;
  const checking = args.flags.has("check");
  const dirty = checking ? [] : dirtyInputs(root);
  if (dirty.length > 0 && !args.flags.has("allow-dirty"))
    return {
      diags: dirty.map((file) => ({
        kind: "diag",
        code: "S0010",
        path: file,
        line: 1,
        col: 1,
        message: "feeds the evidence report and differs from HEAD",
        fix: `-  ${file} (uncommitted)\n+  commit it, or pass --allow-dirty to mark the data as taken from a dirty tree`,
        see: "tooling/evidence-report.mjs",
      })),
      counts: { dirty: dirty.length },
      exit: 2,
    };
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const report = buildReport({
    root,
    ledger: read("tooling/ledger/ledger.json"),
    commit,
    generatedAt: new Date().toISOString(),
    previous,
    dirty,
  });
  const counts = {
    items: report.ledger.items,
    verified: report.ledger.verified,
    units: Object.keys(report.tests.packages).length,
    cases: report.tests.totals.conformanceCases + report.tests.totals.unitCases + report.tests.totals.otherCases,
  };
  if (checking) {
    const unitList = units(root);
    const present = presentInputs(root, unitList);
    const skipped = notChecked(unitList, present);
    const withSkips = { ...counts, notCoverage: skipped.coverage, notMutationReports: skipped.mutationReports };
    if (previous !== undefined && checkedParts(previous, present) === checkedParts(report, present))
      return { diags: [], counts: withSkips };
    const diag = {
      kind: "diag",
      code: "S0007",
      path: OUT,
      line: 1,
      col: 1,
      message: "evidence report differs from the ledger and tests; run pnpm evidence:report",
      see: "tooling/evidence-report.mjs",
    };
    return { diags: [diag], counts: withSkips, exit: 2 };
  }
  fs.writeFileSync(path.join(root, OUT), stableJson(report));
  if (args.flags.has("markdown")) fs.writeFileSync(path.join(root, MD), renderMarkdown(report));
  return { diags: [], counts };
});
