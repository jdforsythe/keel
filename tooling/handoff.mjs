import { spawnSync } from "node:child_process";
// Mechanical /handoff: stamps docs/HANDOFF.md and prints the one-line resume pointer.
import fs from "node:fs";
import path from "node:path";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const git = (...a) => spawnSync("git", a, { cwd: root, encoding: "utf8" }).stdout.trim();

await run("handoff", () => {
  const file = path.join(root, "docs", "HANDOFF.md");
  let text = fs.readFileSync(file, "utf8");
  const task = /^\s*-\s*task:\s*(\S+)/m.exec(text)?.[1];
  const planRel = /^\s*plan:\s*(\S+)/m.exec(text)?.[1];
  if (!task || !planRel)
    return {
      diags: [{ kind: "diag", code: "E0004", path: "docs/HANDOFF.md", message: "no active task/plan entry" }],
      counts: {},
    };
  const planFile = path.join(root, planRel);
  if (!fs.existsSync(planFile))
    return { diags: [{ kind: "diag", code: "E0004", path: planRel, message: "plan file missing" }], counts: {} };
  const plan = fs.readFileSync(planFile, "utf8");
  const after = /^## Next action\s*\n+([^\n]+)/m.exec(plan)?.[1];
  if (!after)
    return { diags: [{ kind: "diag", code: "E0004", path: planRel, message: 'no "Next action" section' }], counts: {} };
  const sha = git("rev-parse", "--short", "HEAD");
  const branch = git("rev-parse", "--abbrev-ref", "HEAD");
  const date = new Date().toISOString().slice(0, 10);
  text = text
    .replace(/^(\s*branch:\s*).*$/m, `$1${branch}`)
    .replace(/^last updated:.*$/m, `last updated: ${sha} ${date}`);
  fs.writeFileSync(file, text);
  const id = task.split("-")[0];
  return { diags: [], counts: {}, line: `resume: /resume (task ${id}, next: ${after.trim()})` };
});
