// PR-gating mutation run (backlog 0080): mutate only packages whose files changed in origin/main...HEAD (or HEAD~50 without origin/main).
// Stryker is incremental (.stryker-tmp/incremental.json, restored by the CI cache), so unchanged mutants are reused.
// A change to the shared Stryker factory or reporter re-runs every package. Usage: node tooling/mutate-changed.mjs [--list]
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { parseArgs, run } from "./output.ts";

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

/** Package dirs (packages/<dir>) touched by `files`; all packages when the shared Stryker tooling changed. */
export function changedPackages(files, all) {
  if (files.some((f) => /^tooling\/(stryker|stryker-reporter)\.mjs$/.test(f))) return all;
  const out = new Set();
  for (const f of files) {
    const m = /^packages\/([^/]+)\//.exec(f);
    if (m && all.includes(m[1]) && !/^packages\/[^/]+\/(reports|\.stryker-tmp|node_modules)\//.test(f)) out.add(m[1]);
  }
  return all.filter((p) => out.has(p));
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();
  await run("mutate-changed", () => {
    const all = fs
      .readdirSync(path.join(root, "packages"))
      .filter((p) => fs.existsSync(path.join(root, "packages", p, "stryker.config.mjs")));
    const range = has("origin/main") ? "origin/main...HEAD" : "HEAD~50...HEAD";
    const pkgs = changedPackages(git("diff", "--name-only", range).split("\n").filter(Boolean), all);
    if (args.flags.has("list") || pkgs.length === 0)
      return { diags: [], counts: { packages: pkgs.length }, line: `ok mutate-changed ${pkgs.join(",") || "none"}` };
    const r = spawnSync("node", ["tooling/turbo.mjs", "mutate", ...pkgs.map((p) => `--filter=@keel/${p}`)], {
      cwd: root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    if (r.stdout) console.log(r.stdout.trimEnd());
    return {
      diags: [],
      counts: { packages: pkgs.length },
      exit: r.status ?? 1,
      line: `ok mutate-changed ${pkgs.join(",")}`,
    };
  });
}
