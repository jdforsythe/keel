// The ledger gate: the committed tooling/ledger/ledger.json against what `keel ledger` produces from the tree now.
// `pnpm ledger --diff` only reports a lowered rung, a higher unsafe count and a missed threshold, so a file edited by
// hand upward, an item whose source is gone and an item the tree gained all pass it; this fails S0011 on each.
// Usage: node tooling/ledger-fresh.mjs           exports, clauses and the unsafe count (what a tree alone decides)
//        node tooling/ledger-fresh.mjs --a11y    also the WCAG items and the count per rung; needs the apps'
//                                                reports/a11y.json (`keel test` in golden-1, golden-2, household and each example, as CI does)
// Not compared: the mutation section (its claims come from reports/mutation/mutation.json, written by nightly runs).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compareLedger, parseFresh } from "./ledger-compare.mjs";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const FILE = "tooling/ledger/ledger.json";
const withA11y = parseArgs().flags.has("a11y");

await run("ledger-fresh", () => {
  const committed = JSON.parse(fs.readFileSync(path.join(root, FILE), "utf8"));
  const r = spawnSync("node", ["packages/cli/src/bin.ts", "ledger", "--format=json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`keel ledger exited ${r.status}: ${r.stderr.trim().split("\n")[0] ?? ""}`);
  const fresh = parseFresh(r.stdout);
  const diffs = compareLedger(committed, fresh, withA11y);
  const diags = diffs.map((d) => ({
    kind: "diag",
    code: "S0011",
    path: FILE,
    line: 1,
    col: 1,
    message: d.message,
    fix: "pnpm ledger",
    see: "tooling/ledger-fresh.mjs",
  }));
  return {
    diags,
    counts: { items: fresh.records.length, ...(withA11y ? {} : { notA11y: committed.a11y?.length ?? 0 }) },
    ...(diags.length > 0 ? { exit: 2 } : {}),
  };
});
