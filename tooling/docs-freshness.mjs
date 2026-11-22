// A doc ages only on commits to its subject: the paths its `subject:` line names, beside `verified:` (globs, space or
// comma separated; a path names everything under it too). A package README's subject is its package's `src/` unless
// it declares one. A doc with no `subject:` line ages on its whole scope (`docs/` for a doc) and W0014 says so.
// A doc with more than MAX commits to its subject since its last change (or `verified: <sha>` bump) fails with D0001.
// A commit that touches only `docs/HANDOFF.md` ages no doc: that file changes at every stopping point.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { run } from "./output.ts";

export const MAX = 50;

/** The globs of a doc's `subject:` line, or undefined when it has none. */
export function parseSubject(text) {
  const m = /^subject:[ \t]*(.*)$/m.exec(text);
  if (!m) return undefined;
  return m[1].split(/[\s,]+/).filter(Boolean);
}

/** Git pathspecs for subject globs: each glob, and everything under it when it names a directory. */
export function pathspecs(globs) {
  return globs.flatMap((g) => {
    const p = g.replace(/\/+$/, "");
    return [`:(glob)${p}`, `:(glob)${p}/**`];
  });
}

/** The docs to age under `root`: package READMEs, then top-level `docs/*.md`, each with its subject or fallback scope. */
export function targets(root) {
  const out = [];
  const pk = path.join(root, "packages");
  if (fs.existsSync(pk))
    for (const p of fs.readdirSync(pk).sort()) {
      const file = `packages/${p}/README.md`;
      if (!fs.existsSync(path.join(root, file))) continue;
      const subject = parseSubject(fs.readFileSync(path.join(root, file), "utf8")) ?? [`packages/${p}/src`];
      out.push({ file, subject });
    }
  const docs = path.join(root, "docs");
  if (fs.existsSync(docs))
    for (const f of fs.readdirSync(docs).sort()) {
      if (!f.endsWith(".md")) continue;
      const file = `docs/${f}`;
      const subject = parseSubject(fs.readFileSync(path.join(root, file), "utf8"));
      out.push(subject ? { file, subject } : { file, scope: "docs" });
    }
  return out;
}

/** Diagnostics for the docs under `root` (a git work tree): D0001 per stale doc, W0014 per doc with no subject. */
export function freshness(root, max = MAX) {
  const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
  const out = (...a) => {
    const r = git(...a);
    return r.status === 0 ? r.stdout.trim() : "";
  };
  const diags = [];
  const list = targets(root);
  for (const t of list) {
    const { file } = t;
    if (!t.subject)
      diags.push({
        kind: "diag",
        code: "W0014",
        path: file,
        line: 1,
        col: 1,
        message: `no subject: line; ages on every commit to ${t.scope}/`,
      });
    let base = out("log", "-1", "--format=%H", "--", file);
    if (!base) continue; // untracked or new: nothing to age
    const v = /^verified:\s*([0-9a-f]{7,40})/m.exec(fs.readFileSync(path.join(root, file), "utf8"))?.[1];
    if (v && git("merge-base", "--is-ancestor", base, v).status === 0) base = v;
    const specs = t.subject ? pathspecs(t.subject) : [t.scope];
    const n = Number(out("rev-list", "--count", `${base}..HEAD`, "--", ...specs, ":(exclude)docs/HANDOFF.md") || 0);
    if (n > max) {
      const what = t.subject ? "its subject" : t.scope;
      diags.push({
        kind: "diag",
        code: "D0001",
        path: file,
        line: 1,
        col: 1,
        message: `${n} commits to ${what} since last change; update and bump verified: <sha>`,
      });
    }
  }
  return { diags, counts: { docs: list.length } };
}

if (process.argv[1] === new URL(import.meta.url).pathname)
  await run("docs-freshness", () => freshness(path.join(import.meta.dirname, "..")));
