// Mutation run for the work at hand: only packages with changed files, and inside a package only its changed
// `src` files when nothing else in it changed (prose aside). Range: `--base <ref>...HEAD` (default origin/master, or HEAD~50 without it).
// Stryker is incremental (shared cache, tooling/mutate-cache.ts), so unchanged mutants are reused either way.
// A change to the shared mutation tooling runs every package whole. Usage: node tooling/mutate-changed.mjs [--base <ref>] [--list]
// A stop (`pnpm mutate:stop`, Ctrl-C, SIGTERM) ends the whole sequence: the live package's run stops and no further
// package starts.
import { execFileSync, spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mutateCacheDir } from "./mutate-cache.ts";
import { mutatedRule, mutationUnits, unitDir } from "./mutate-units.mjs";
import { stopFile } from "./mutate.mjs";
import { acquire, lockedDiag } from "./mutateLock.mjs";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const git = (...a) => execFileSync("git", a, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
const has = (ref) => {
  try {
    git("rev-parse", "--verify", "-q", ref);
    return true;
  } catch {
    return false;
  }
};

const SHARED =
  /^tooling\/(stryker|stryker-reporter|mutate|mutate-units|mutateLock|quick-first|mutate-cache|vitest\.mutate\.config)\.(mjs|ts)$/;
const IGNORED = /^(reports|\.stryker-tmp|node_modules)\//;
const UNIT_FILE = /^((?:packages|apps)\/[^/]+)\/(.+)$/;

/**
 * What to run for `files` (repo-relative changed paths): one entry per unit in `all` order. A unit is a package name or
 * `apps/<name>`; `pkg` in the result is that same string.
 * `mutate` lists the package-relative `src` files to scope the run to; absent means the whole package.
 */
export function changedScope(files, all) {
  if (files.some((f) => SHARED.test(f))) return all.map((pkg) => ({ pkg }));
  const by = new Map();
  for (const f of files) {
    const m = UNIT_FILE.exec(f);
    const unit = m && all.find((u) => unitDir(u) === m[1]);
    if (!m || unit === undefined || IGNORED.test(m[2])) continue;
    const e = by.get(unit) ?? { src: [], whole: false };
    if (mutatedRule(unit).test(m[2])) e.src.push(m[2]);
    else if (!/\.md$/.test(m[2])) e.whole = true;
    by.set(unit, e);
  }
  return all
    .filter((p) => by.get(p)?.whole || by.get(p)?.src.length)
    .map((pkg) => {
      const e = by.get(pkg);
      return e.whole ? { pkg } : { pkg, mutate: e.src };
    });
}

const show = (s) => (s.mutate ? `${s.pkg}(${s.mutate.length} files)` : s.pkg);

/** True when a stop was requested at or after `since` (ms): the stop file `mutate:stop` writes. */
export function stopRequested(file, since) {
  try {
    const at = JSON.parse(fs.readFileSync(file, "utf8"))?.at;
    return typeof at === "number" && at >= since;
  } catch {
    return false;
  }
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const argv = process.argv.slice(2);
  const at = argv.indexOf("--base");
  const base = at >= 0 ? argv[at + 1] : has("origin/master") ? "origin/master" : "HEAD~50";
  await run("mutate-changed", async () => {
    const all = mutationUnits(root);
    // A file deleted in the range has no mutants left to run.
    const changed = git("diff", "--name-only", "--diff-filter=d", `${base}...HEAD`).split("\n").filter(Boolean);
    const scope = changedScope(changed, all);
    const line = `ok mutate-changed ${scope.map(show).join(",") || "none"}`;
    if (argv.includes("--list") || scope.length === 0) return { diags: [], counts: { packages: scope.length }, line };
    // The whole sequence holds the lock, so no second run starts between two packages; each package's runner passes.
    const lock = acquire();
    if (!lock.held) return { diags: [lockedDiag(lock.holder)], counts: { packages: scope.length } };
    const since = Date.now();
    const stops = stopFile(mutateCacheDir(root));
    let child;
    let signalled = false;
    // The runner owns the one SIGINT to its Stryker group; a signal here is passed to it once and ends the sequence.
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"])
      process.on(sig, () => {
        signalled = true;
        child?.kill(sig);
      });
    let exit = 0;
    let ran = 0;
    for (const s of scope) {
      if (signalled || stopRequested(stops, since)) break;
      // One package at a time: each Stryker run fills the cores by itself.
      child = spawn(
        "node",
        [path.join(root, "tooling", "mutate.mjs"), ...(s.mutate ? ["--mutate", s.mutate.join(",")] : [])],
        { cwd: path.join(root, unitDir(s.pkg)), stdio: ["ignore", "pipe", "inherit"] },
      );
      const out = [];
      child.stdout.on("data", (b) => out.push(b));
      const status = await new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
      const text = Buffer.concat(out).toString("utf8").trimEnd();
      if (text) console.log(text);
      ran++;
      exit ||= status;
      if (status === 130) break;
    }
    const skipped = scope.length - ran;
    return { diags: [], counts: { packages: scope.length, skipped }, exit, line };
  });
}
