// Writes tooling/ledger/evidence.json: the ledger's totals by section and rung, static test counts per unit,
// mutation per unit and line and branch coverage per unit (tooling/evidence.mjs has the shape and counting rules).
// Usage: pnpm evidence:report             write evidence.json
//        pnpm evidence:report --check     exit 2 with S0007 when its ledger and test parts differ from a fresh count
//        pnpm evidence:report --markdown  write evidence.json, then tasks/COVERAGE.md from it
// Mutation and coverage are measured by runs (pnpm mutate, pnpm coverage); a unit with no local measurement keeps
// the committed file's entry, and --check does not compare them.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { renderMarkdown } from "./evidence-markdown.mjs";
import { buildReport, checkedParts, stableJson } from "./evidence.mjs";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const OUT = "tooling/ledger/evidence.json";
const MD = "tasks/COVERAGE.md";
const args = parseArgs();
const read = (rel) => JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));

await run("evidence-report", () => {
  const previous = fs.existsSync(path.join(root, OUT)) ? read(OUT) : undefined;
  const commit = spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const report = buildReport({
    root,
    ledger: read("tooling/ledger/ledger.json"),
    commit,
    generatedAt: new Date().toISOString(),
    previous,
  });
  const counts = {
    items: report.ledger.items,
    verified: report.ledger.verified,
    units: Object.keys(report.tests.packages).length,
    cases: report.tests.totals.conformanceCases + report.tests.totals.unitCases + report.tests.totals.otherCases,
  };
  if (args.flags.has("check")) {
    if (previous !== undefined && checkedParts(previous) === checkedParts(report)) return { diags: [], counts };
    const diag = {
      kind: "diag",
      code: "S0007",
      path: OUT,
      line: 1,
      col: 1,
      message: "evidence report differs from the ledger and tests; run pnpm evidence:report",
      see: "tooling/evidence-report.mjs",
    };
    return { diags: [diag], counts, exit: 2 };
  }
  fs.writeFileSync(path.join(root, OUT), stableJson(report));
  if (args.flags.has("markdown")) fs.writeFileSync(path.join(root, MD), renderMarkdown(report));
  return { diags: [], counts };
});
