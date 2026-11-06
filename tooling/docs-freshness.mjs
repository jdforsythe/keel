import { spawnSync } from "node:child_process";
// A doc with more than 50 commits to its scope since its last change (or `verified: <sha>` bump) fails with D0001.
import fs from "node:fs";
import path from "node:path";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const MAX = 50;
const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" });
const out = (...a) => {
  const r = git(...a);
  return r.status === 0 ? r.stdout.trim() : "";
};

const targets = [];
const pk = path.join(root, "packages");
if (fs.existsSync(pk))
  for (const p of fs.readdirSync(pk).sort())
    if (fs.existsSync(path.join(pk, p, "README.md")))
      targets.push({ file: `packages/${p}/README.md`, scope: `packages/${p}` });
const docs = path.join(root, "docs");
if (fs.existsSync(docs))
  for (const f of fs.readdirSync(docs).sort())
    if (f.endsWith(".md")) targets.push({ file: `docs/${f}`, scope: "docs" });

await run("docs-freshness", () => {
  const diags = [];
  for (const { file, scope } of targets) {
    let base = out("log", "-1", "--format=%H", "--", file);
    if (!base) continue; // untracked or new: nothing to age
    const v = /^verified:\s*([0-9a-f]{7,40})/m.exec(fs.readFileSync(path.join(root, file), "utf8"))?.[1];
    if (v && git("merge-base", "--is-ancestor", base, v).status === 0) base = v;
    const n = Number(out("rev-list", "--count", `${base}..HEAD`, "--", scope) || 0);
    if (n > MAX)
      diags.push({
        kind: "diag",
        code: "D0001",
        path: file,
        line: 1,
        col: 1,
        message: `${n} commits to ${scope} since last change; update and bump verified: <sha>`,
      });
  }
  return { diags, counts: { docs: targets.length } };
});
