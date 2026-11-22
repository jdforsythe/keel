// The evidence report's parts, computed from committed or generated data only (tooling/evidence-report.mjs writes
// them to tooling/ledger/evidence.json). Pure functions over file text, plus the readers that feed them.
//
// Counting rules for the test part (static: read from the files, nothing is run):
// - A unit is a directory `packages/<name>` or `apps/<name>`. Its test files are the files under it whose name ends
//   in `.test.<ext>` (ts, tsx, mts, cts, js, jsx, mjs) that git tracks or would track (`git ls-files --cached
//   --others --exclude-standard`), so ignored scratch and session files never count. Outside a git checkout every
//   file counts, skipping node_modules, dist, coverage, reports, .turbo, .stryker-tmp* and .tmp-* directories.
// - A test file's kind: `conformance` when a directory on its path (inside the unit) is `conformance`, else `unit`
//   when one is `test`, else `other`.
// - Comments are blanked and string and template contents emptied first, so text inside a string never counts.
// - A case is a call `it(` or `test(`, optionally through modifiers drawn from only, skip, todo, each, fails,
//   concurrent, sequential, skipIf, runIf and for (`it.each(rows)(` is one case, `it.skipIf(c)(` is one case).
//   A declaration `function it(` or `function test(` is not a case.
//   `fails` is the cases with the `fails` modifier and `skipTodo` the cases with `skip`, `skipIf` or `todo`; both are
//   already inside the case counts.
// - A property call is a call `fc.assert(` or `properties(`; a case can hold more than one, and a call is counted
//   once however many runs it makes.
// - `simulateFiles`, `exploreFiles` and `proveFiles` count the test files that call `simulate(`, `explore(` or
//   `prove(` at least once.
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { scrub, walk } from "./scan.mjs";

/** The evidence.json shape version; a change to the shape raises it. */
export const SCHEMA = 1;
/** The report tool's version; a change to how a number is computed raises it. */
export const TOOL_VERSION = 1;
/** Rungs from none to the strongest, the order every `byRung` object lists. */
export const RUNGS = ["none", "example", "probabilistic", "exhaustive", "proven", "monitored"];
export const TEST_FIELDS = [
  "conformanceFiles",
  "conformanceCases",
  "unitFiles",
  "unitCases",
  "otherFiles",
  "otherCases",
  "propertyCalls",
  "simulateFiles",
  "exploreFiles",
  "proveFiles",
  "fails",
  "skipTodo",
];

const TEST_FILE = /\.test\.(?:ts|tsx|mts|cts|js|jsx|mjs)$/;
const MODIFIERS = new Set([
  "only",
  "skip",
  "todo",
  "each",
  "fails",
  "concurrent",
  "sequential",
  "skipIf",
  "runIf",
  "for",
]);
const CASE = /(?<![\w$.])(?<!function\s{1,4})(?:it|test)((?:\s*\.\s*[A-Za-z]+)*)\s*\(/g;
const PROPERTY = /(?<![\w$.])(?:fc\s*\.\s*assert|properties)\s*\(/g;
const call = (name) => new RegExp(`(?<![\\w$.])${name}\\s*\\(`);

const byRung = () => Object.fromEntries(RUNGS.map((r) => [r, 0]));
const zeroTests = () => Object.fromEntries(TEST_FIELDS.map((f) => [f, 0]));

/** Counts of one test file's text: cases, fails, skipTodo, property calls, and whether it calls simulate/explore/prove. */
export function countTestText(source) {
  const code = scrub(source).code.join("\n");
  let cases = 0;
  let fails = 0;
  let skipTodo = 0;
  for (const m of code.matchAll(CASE)) {
    const mods = (m[1] ?? "")
      .split(".")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!mods.every((x) => MODIFIERS.has(x))) continue;
    cases++;
    if (mods.includes("fails")) fails++;
    if (mods.some((x) => x === "skip" || x === "skipIf" || x === "todo")) skipTodo++;
  }
  return {
    cases,
    fails,
    skipTodo,
    propertyCalls: [...code.matchAll(PROPERTY)].length,
    simulate: call("simulate").test(code),
    explore: call("explore").test(code),
    prove: call("prove").test(code),
  };
}

/** The kind of a test file from its path inside the unit: conformance, unit or other. */
export function testKind(relInUnit) {
  const dirs = relInUnit.split("/").slice(0, -1);
  if (dirs.includes("conformance")) return "conformance";
  if (dirs.includes("test")) return "unit";
  return "other";
}

/** Totals of one unit from its test files: `[{ path (inside the unit), source }]`. */
export function countUnit(files) {
  const t = zeroTests();
  for (const f of files) {
    const kind = testKind(f.path);
    const c = countTestText(f.source);
    t[`${kind}Files`]++;
    t[`${kind}Cases`] += c.cases;
    t.propertyCalls += c.propertyCalls;
    t.fails += c.fails;
    t.skipTodo += c.skipTodo;
    if (c.simulate) t.simulateFiles++;
    if (c.explore) t.exploreFiles++;
    if (c.prove) t.proveFiles++;
  }
  return t;
}

/** The units of a tree: `packages/<name>` and `apps/<name>` directories, sorted. */
export function units(root) {
  const out = [];
  for (const top of ["apps", "packages"]) {
    const dir = path.join(root, top);
    if (!fs.existsSync(dir)) continue;
    for (const e of fs.readdirSync(dir, { withFileTypes: true }))
      if (e.isDirectory() && fs.existsSync(path.join(dir, e.name, "package.json"))) out.push(`${top}/${e.name}`);
  }
  return out.sort();
}

/** The files under `dir`, relative to it with `/` separators, sorted: git's view when `dir` is in a checkout. */
function listed(dir) {
  const r = spawnSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", "."], {
    cwd: dir,
    encoding: "utf8",
  });
  const files =
    r.status === 0
      ? r.stdout.split("\0").filter((f) => f !== "" && fs.existsSync(path.join(dir, f)))
      : walk(dir).map((f) => path.relative(dir, f).split(path.sep).join("/"));
  return [...new Set(files)].sort();
}

/** Part (b): per unit test counts and their totals, read from the tree at `root`. */
export function testsPart(root) {
  const packages = {};
  const totals = zeroTests();
  for (const u of units(root)) {
    const abs = path.join(root, u);
    const files = listed(abs)
      .filter((f) => TEST_FILE.test(f))
      .map((f) => ({ path: f, source: fs.readFileSync(path.join(abs, f), "utf8") }));
    if (files.length === 0) continue;
    const t = countUnit(files);
    packages[u] = t;
    for (const f of TEST_FIELDS) totals[f] += t[f];
  }
  return { packages, totals };
}

/** The `status:` line of each spec section file under `spec/kernel` and `spec/std`: id -> status. */
export function specStatuses(root) {
  const out = {};
  for (const sub of ["kernel", "std"]) {
    const dir = path.join(root, "spec", sub);
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((n) => n.endsWith(".md"))) {
      const m = /^status:\s*(\S+)/m.exec(fs.readFileSync(path.join(dir, f), "utf8"));
      out[f.slice(0, -3)] = m ? m[1] : "unknown";
    }
  }
  return out;
}

const tally = (items) => {
  const r = byRung();
  for (const i of items) r[i.rung] = (r[i.rung] ?? 0) + 1;
  return { byRung: r, total: items.length, verified: items.length - r.none };
};

/** Part (a): the committed ledger file's totals, clauses per spec section, exports and WCAG items, all by rung. */
export function ledgerPart(ledger, statuses) {
  const clauses = ledger.clauses ?? [];
  const exportsList = ledger.exports ?? [];
  const a11y = ledger.a11y ?? [];
  const groups = new Map(Object.keys(statuses).map((id) => [id, []]));
  for (const c of clauses) {
    const id = c.item.slice(0, c.item.lastIndexOf("#"));
    groups.set(id, [...(groups.get(id) ?? []), c]);
  }
  const sections = {};
  for (const [id, list] of groups) sections[id] = { status: statuses[id] ?? "unknown", ...tally(list) };
  const pkgs = new Map();
  for (const e of exportsList) pkgs.set(e.pkg, [...(pkgs.get(e.pkg) ?? []), e]);
  const all = [...clauses, ...exportsList, ...a11y];
  return {
    items: all.length,
    verified: all.filter((i) => i.rung !== "none").length,
    unsafe: ledger.unsafe ?? 0,
    evidenceByRung: { ...ledger.rungs },
    clauses: { ...tally(clauses), sections },
    exports: { ...tally(exportsList), packages: Object.fromEntries([...pkgs].map(([p, l]) => [p, tally(l)])) },
    a11y: tally(a11y),
  };
}

const sha256 = (file) => crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
const MUTATION_NONE = {
  claims: 0,
  justified: null,
  reportDate: null,
  score: null,
  scoreJustified: null,
  stale: null,
  threshold: null,
};
const COVERAGE_NONE = {
  branches: null,
  commit: null,
  dirty: null,
  functions: null,
  lines: null,
  measuredAt: null,
  statements: null,
};
const day = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * Part (c): per unit mutation score, justified survivors, the score with them left out (`scoreJustified`) and
 * threshold (ledger), the report's date (the modification day of
 * `reports/mutation/mutation.json`), claims and stale claims (a claim's sha256 differs from the file on disk). A unit
 * the ledger has no score for keeps its entry in `previous` when that one was measured, else it is `null`s with a
 * reason.
 */
export function mutationPart(root, ledger, unitList, previous = {}) {
  const scores = ledger.mutation?.packages ?? {};
  const claims = ledger.mutation?.claims ?? [];
  const packages = {};
  let stale = 0;
  for (const u of unitList) {
    const name = u.split("/")[1];
    const s = u.startsWith("packages/") ? scores[name] : undefined;
    if (s === undefined) {
      packages[u] = previous[u]?.reason === null ? previous[u] : { ...MUTATION_NONE, reason: "no mutation run" };
      continue;
    }
    const mine = claims.filter((c) => c.file.startsWith(`${u}/`));
    const n = mine.filter((c) => {
      const f = path.join(root, c.file);
      return fs.existsSync(f) && sha256(f) !== c.sha;
    }).length;
    stale += n;
    const report = path.join(root, u, "reports", "mutation", "mutation.json");
    const reportDate = fs.existsSync(report) ? day(fs.statSync(report).mtimeMs) : (previous[u]?.reportDate ?? null);
    packages[u] = {
      claims: mine.length,
      justified: s.justified ?? 0,
      reason: null,
      reportDate,
      score: s.score,
      scoreJustified: s.scoreJustified ?? s.score,
      stale: n,
      threshold: s.threshold,
    };
  }
  return { packages, stale };
}

/**
 * Part (d): per unit coverage from `coverage/coverage-summary.json` and `coverage/meta.json` (tooling/coverage.mjs).
 * A unit with no summary keeps its entry in `previous` when that one was measured, else it is `null`s with
 * "not measured".
 */
export function coveragePart(root, unitList, previous = {}) {
  const packages = {};
  for (const u of unitList) {
    const summary = path.join(root, u, "coverage", "coverage-summary.json");
    if (!fs.existsSync(summary)) {
      packages[u] = previous[u]?.reason === null ? previous[u] : { ...COVERAGE_NONE, reason: "not measured" };
      continue;
    }
    const { total } = JSON.parse(fs.readFileSync(summary, "utf8"));
    const metaFile = path.join(root, u, "coverage", "meta.json");
    const meta = fs.existsSync(metaFile) ? JSON.parse(fs.readFileSync(metaFile, "utf8")) : {};
    const metric = (m) => ({ covered: m.covered, pct: m.pct, total: m.total });
    packages[u] = {
      branches: metric(total.branches),
      commit: meta.commit ?? null,
      dirty: meta.dirty ?? null,
      functions: metric(total.functions),
      lines: metric(total.lines),
      measuredAt: meta.measuredAt ?? null,
      reason: null,
      statements: metric(total.statements),
    };
  }
  return { packages };
}

/** JSON with object keys sorted at every depth, two-space indent and a final newline. */
export function stableJson(value) {
  const sort = (v) =>
    Array.isArray(v)
      ? v.map(sort)
      : v !== null && typeof v === "object"
        ? Object.fromEntries(
            Object.keys(v)
              .sort()
              .map((k) => [k, sort(v[k])]),
          )
        : v;
  return `${JSON.stringify(sort(value), null, 2)}\n`;
}

/**
 * The units whose local measurement files exist under `root`: `coverage` has a `coverage/coverage-summary.json` and
 * `mutationReports` has a `reports/mutation/mutation.json`. Both are written by runs and are not committed.
 */
export function presentInputs(root, unitList) {
  const has = (u, ...rel) => fs.existsSync(path.join(root, u, ...rel));
  return {
    coverage: unitList.filter((u) => has(u, "coverage", "coverage-summary.json")),
    mutationReports: unitList.filter((u) => has(u, "reports", "mutation", "mutation.json")),
  };
}

/**
 * The parts `--check` compares, as text: the ledger, the tests, the schema and tool, and the mutation parts the
 * committed tree decides (score, justified survivors, threshold, claims, stale claims). The header (commit, time) is left out. A unit's
 * coverage entry and a unit's mutation report date are compared only when `present` lists the unit, because their
 * source files come from local runs. A report marked `dirty` never equals a fresh one, which is not.
 */
export function checkedParts(report, present = { coverage: [], mutationReports: [] }) {
  const mutation = Object.fromEntries(
    Object.entries(report.mutation.packages).map(([u, m]) => [
      u,
      present.mutationReports.includes(u) ? m : { ...m, reportDate: undefined },
    ]),
  );
  const coverage = Object.fromEntries(present.coverage.map((u) => [u, report.coverage.packages[u]]));
  return stableJson({
    coverage,
    dirty: report.dirty ?? null,
    ledger: report.ledger,
    mutation: { packages: mutation, stale: report.mutation.stale },
    schema: report.schema,
    tests: report.tests,
    tool: report.tool,
  });
}

/** What `--check` leaves out for want of local files: units without a coverage summary and without a mutation report. */
export function notChecked(unitList, present) {
  return {
    coverage: unitList.filter((u) => !present.coverage.includes(u)).length,
    mutationReports: unitList.filter((u) => !present.mutationReports.includes(u)).length,
  };
}

const SPEC_FILE = /^spec\/(?:kernel|std)\/[^/]+\.md$/;
const UNIT_MANIFEST = /^(?:apps|packages)\/[^/]+\/package\.json$/;
const UNIT_TEST = /^(?:apps|packages)\/[^/]+\/(?:.+\/)?[^/]+\.test\.(?:ts|tsx|mts|cts|js|jsx|mjs)$/;

/** Whether a repo-relative path is a file the report reads from the tree: a spec section, a unit manifest or a test file. */
export const feedsReport = (rel) => SPEC_FILE.test(rel) || UNIT_MANIFEST.test(rel) || UNIT_TEST.test(rel);

/**
 * The paths that differ from HEAD (modified, staged, deleted, renamed or untracked and not ignored) among the files
 * the report reads: spec sections, unit manifests and test files, sorted. The committed ledger file and the report's
 * own outputs are not listed: `pnpm ledger` rewrites the first just before a report is written, and the
 * ledger gate compares it with the tree. Outside a git checkout nothing is known and the list is empty.
 */
export function dirtyInputs(root) {
  const r = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"], {
    cwd: root,
    encoding: "utf8",
  });
  if (r.status !== 0) return [];
  const prefix = spawnSync("git", ["rev-parse", "--show-prefix"], { cwd: root, encoding: "utf8" }).stdout.trim();
  const entries = r.stdout.split("\0").filter((e) => e !== "");
  const paths = [];
  for (let i = 0; i < entries.length; i++) {
    const status = entries[i].slice(0, 2);
    paths.push(entries[i].slice(3));
    // A rename or copy lists its origin as the next entry.
    if (/[RC]/.test(status)) paths.push(entries[++i] ?? "");
  }
  return [...new Set(paths.filter((p) => p.startsWith(prefix)).map((p) => p.slice(prefix.length)))]
    .filter(feedsReport)
    .sort();
}

/** The whole report: header, ledger, tests, mutation and coverage. `previous` is the committed report, if any. */
export function buildReport({ root, ledger, commit, generatedAt, previous, dirty = [] }) {
  const tests = testsPart(root);
  const unitList = units(root);
  return {
    commit,
    coverage: coveragePart(root, unitList, previous?.coverage?.packages),
    ...(dirty.length > 0 ? { dirty } : {}),
    generatedAt,
    ledger: ledgerPart(ledger, specStatuses(root)),
    mutation: mutationPart(root, ledger, unitList, previous?.mutation?.packages),
    schema: SCHEMA,
    tests,
    tool: { name: "tooling/evidence-report.mjs", version: TOOL_VERSION },
  };
}
