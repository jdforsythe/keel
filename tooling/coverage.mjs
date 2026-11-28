// A package's `coverage` script: runs its tests once with v8 coverage (KEEL_COVERAGE=1, tooling/coverage-config.ts),
// then writes `coverage/meta.json` beside vitest's `coverage/coverage-summary.json`: the package, the commit the
// numbers were measured at, whether the package's files differed from that commit, and when.
// Usage (in a package directory): node ../../tooling/coverage.mjs   ·   all packages: pnpm coverage [--filter <pkg>]
// It reports; it sets no floor. A test failure fails the run and still writes what was measured.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { run } from "./output.ts";

const dir = process.cwd();
const name = JSON.parse(fs.readFileSync(path.join(dir, "package.json"), "utf8")).name;
const git = (args) => spawnSync("git", args, { cwd: dir, encoding: "utf8" }).stdout.trim();
const pct = (m) => `${m.pct}%`;

await run(`coverage ${name}`, () => {
  const t0 = performance.now();
  const r = spawnSync("vitest", ["run"], { cwd: dir, stdio: "inherit", env: { ...process.env, KEEL_COVERAGE: "1" } });
  const summaryFile = path.join(dir, "coverage", "coverage-summary.json");
  if (!fs.existsSync(summaryFile))
    return {
      diags: [
        { kind: "diag", code: "E0006", path: path.relative(dir, summaryFile), message: "no coverage summary written" },
      ],
      counts: {},
      exit: r.status || 1,
    };
  const meta = {
    commit: git(["rev-parse", "HEAD"]),
    dirty: git(["status", "--porcelain", "--", "."]) !== "",
    measuredAt: new Date().toISOString(),
    package: name,
    schema: 1,
  };
  fs.writeFileSync(path.join(dir, "coverage", "meta.json"), `${JSON.stringify(meta, null, 2)}\n`);
  const { total } = JSON.parse(fs.readFileSync(summaryFile, "utf8"));
  const s = ((performance.now() - t0) / 1000).toFixed(1);
  const line = `ok coverage ${name} ${pct(total.lines)} lines, ${pct(total.branches)} branches, ${pct(total.functions)} functions, ${pct(total.statements)} statements (${s}s)`;
  return { diags: [], counts: { lines: total.lines.pct, branches: total.branches.pct }, line, exit: r.status ?? 1 };
});
