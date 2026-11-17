// S0008: a commit that modifies, renames or deletes packages/*/conformance/** must carry a valid rfc:NNNN in ITS OWN message (docs/RFC.md).
// Valid = docs/rfc/NNNN-*.md exists at that commit, or rfc:0000 while every spec section of the package is `proposed`. Pure additions are allowed (suites are written before implementation).
// Usage: node tooling/conformance-guard.mjs --msg-file=<file>   (git commit-msg hook: checks the staged diff)
//        node tooling/conformance-guard.mjs [--range a..b]       (CI: every non-merge commit in origin/master..HEAD, else last 50)
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import { parseArgs, run } from "./output.ts";

const CONF = /^packages\/([^/]+)\/conformance\//;
const git = (...a) =>
  execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], maxBuffer: 1 << 26 });
const tryGit = (...a) => {
  try {
    return git(...a);
  } catch {
    return undefined;
  }
};

/** rev "" = the index (staged state); otherwise a commit. */
const listFiles = (rev) =>
  (rev === "" ? git("ls-files") : git("ls-tree", "-r", "--name-only", rev)).split("\n").filter(Boolean);
const show = (rev, p) => tryGit("show", `${rev}:${p}`);

/** Why `message` does not authorise changing `pkgs` at `rev`, or undefined when it does. */
export function problem(message, pkgs, rev) {
  const text = message
    .split("\n")
    .filter((l) => !l.startsWith("#"))
    .join("\n");
  const tags = [...text.matchAll(/\brfc:(\d{4})\b/g)].map((m) => m[1]);
  if (tags.length === 0) return "conformance change needs rfc:NNNN in this commit message; run /rfc";
  const all = listFiles(rev);
  const real = tags.find((t) => t !== "0000" && all.some((f) => new RegExp(`^docs/rfc/${t}-[^/]+\\.md$`).test(f)));
  if (real) return undefined;
  if (!tags.includes("0000")) return `rfc:${tags[0]} has no docs/rfc/${tags[0]}-*.md; file the RFC first`;
  for (const pkg of pkgs) {
    // rfc:0000 = pre-implementation lint/shape fixes; only while every spec section of the package is `proposed`.
    const ids = [...(show(rev, `packages/${pkg}/README.md`) ?? "").matchAll(/\bk\.[a-z-]+/g)].map((m) => m[0]);
    const proposed =
      ids.length > 0 && ids.every((id) => /^status: proposed/m.test(show(rev, `spec/kernel/${id}.md`) ?? ""));
    if (!proposed) return `rfc:0000 not accepted for ${pkg}: section already implemented; file a numbered RFC`;
  }
  return undefined;
}

/** Packages whose conformance files are changed (not merely added) by the given name-status lines. */
export function touchedPackages(nameStatus) {
  const out = new Set();
  for (const line of nameStatus.split("\n").filter(Boolean)) {
    const [st, ...paths] = line.split("\t");
    if (st.startsWith("A")) continue;
    for (const p of paths) {
      const m = CONF.exec(p);
      if (m) out.add(m[1]);
    }
  }
  return [...out];
}

if (import.meta.main ?? process.argv[1] === new URL(import.meta.url).pathname) {
  const args = parseArgs();
  const msgFile = args.values.get("msg-file");
  await run("conformance-guard", () => {
    const diags = [];
    const fail = (where, why) => diags.push({ kind: "diag", code: "S0008", path: where, message: why });
    if (msgFile !== undefined) {
      const pkgs = touchedPackages(git("diff", "--cached", "--name-status", "--no-renames"));
      const why = pkgs.length ? problem(fs.readFileSync(msgFile, "utf8"), pkgs, "") : undefined;
      if (why) fail("COMMIT_EDITMSG", why);
      return { diags, counts: { commits: 1 } };
    }
    const range = args.values.get("range");
    const base = tryGit("rev-parse", "--verify", "-q", "origin/master") ? "origin/master..HEAD" : undefined;
    const revs = (
      range
        ? git("rev-list", "--no-merges", range)
        : base
          ? git("rev-list", "--no-merges", base)
          : git("rev-list", "--no-merges", "-n", "50", "HEAD")
    )
      .split("\n")
      .filter(Boolean);
    for (const sha of revs) {
      const pkgs = touchedPackages(git("show", "--format=", "--name-status", "--no-renames", sha));
      if (!pkgs.length) continue;
      const why = problem(git("log", "-1", "--format=%B", sha), pkgs, sha);
      if (why) fail(sha.slice(0, 10), why);
    }
    return { diags, counts: { commits: revs.length } };
  });
}
