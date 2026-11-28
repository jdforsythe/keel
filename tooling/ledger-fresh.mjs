// The ledger gate: the committed tooling/ledger/ledger.json against what `keel ledger` produces from the tree now.
// `pnpm ledger --diff` only reports a lowered rung, a higher unsafe count and a missed threshold, so a file edited by
// hand upward, an item whose source is gone and an item the tree gained all pass it; this fails S0011 on each, and
// passes on each E1732 and E1733 `keel ledger` reports (a citation or a clause list it cannot read). Clauses compare by
// key; a message names a clause the tree holds by its position too.
// Usage: node tooling/ledger-fresh.mjs          which export and clause items exist, and the unsafe and negative type
//                                               counts (what a tree alone decides)
//        node tooling/ledger-fresh.mjs --runs   also every rung, the WCAG items and the count per rung; needs every
//                                               project's reports/tests/*.json (`pnpm test`) and the apps' reports/a11y.json
//                                               (`keel test` in golden-1, golden-2, household, inspector, sessions and each example)
// Not compared: the mutation section (its claims come from reports/mutation/mutation.json, written by nightly runs).
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { compareLedger, parseFresh } from "./ledger-compare.mjs";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const FILE = "tooling/ledger/ledger.json";
const withRuns = parseArgs().flags.has("runs");

await run("ledger-fresh", () => {
  const committed = JSON.parse(fs.readFileSync(path.join(root, FILE), "utf8"));
  const r = spawnSync("node", ["packages/cli/src/bin.ts", "ledger", "--format=json"], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  // Exit 1 is an error diagnostic of the run's own (E1732, E1733), passed on below; anything else is no ledger.
  if (r.status !== 0 && r.status !== 1)
    throw new Error(`keel ledger exited ${r.status}: ${r.stderr.trim().split("\n")[0] ?? ""}`);
  const fresh = parseFresh(r.stdout);
  const diffs = compareLedger(committed, fresh, withRuns);
  const unread = fresh.unread.map((d) => ({
    kind: "diag",
    code: d.code,
    ...(d.path === undefined ? {} : { path: d.path, line: d.line ?? 1, col: d.col ?? 1 }),
    message: d.message,
    see: d.see ?? "k.ledger-items",
  }));
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
    diags: [...unread, ...diags],
    counts: { items: fresh.records.length, ...(withRuns ? {} : { notRuns: committed.a11y?.length ?? 0 }) },
    ...(diags.length + unread.length > 0 ? { exit: 2 } : {}),
  };
});
