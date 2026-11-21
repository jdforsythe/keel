// Orphan sweep. O0001 a process of this worktree whose parent is gone (PPID 1): a test worker, a dev server or a
// helper that outlived the command that started it. Usage: node tooling/orphans.mjs [--kill] [--format=..] [--quiet]
// Without --kill it lists and fails; with --kill it sends SIGTERM, then SIGKILL to what is alive 5 s later.
// A mutation run's processes are not listed: `pnpm mutate:status` and `pnpm mutate:stop` own them.
import { spawnSync } from "node:child_process";
import path from "node:path";
import { parseArgs, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const MUTATION = /stryker|tooling\/mutate\.mjs/i;
const GRACE_MS = 5000;

/** The orphans in `ps -Ao pid=,ppid=,etime=,command=` text: PPID 1, the root in the command, not `self`, not a mutation run. */
export function orphansIn(text, rootDir, self) {
  const out = [];
  for (const line of text.split("\n")) {
    const m = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/.exec(line);
    if (m === null) continue;
    const [, pid, ppid, age, command] = m;
    if (ppid !== "1" || Number(pid) === self) continue;
    if (!command.includes(`${rootDir}/`) || MUTATION.test(command)) continue;
    out.push({ pid: Number(pid), age, command });
  }
  return out;
}

const alive = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
};

/** SIGTERM to each, then SIGKILL to what is alive after the grace; the pids that would not die. */
async function kill(pids) {
  for (const pid of pids) if (alive(pid)) process.kill(pid, "SIGTERM");
  const until = Date.now() + GRACE_MS;
  while (Date.now() < until && pids.some(alive)) await new Promise((r) => setTimeout(r, 100));
  for (const pid of pids) if (alive(pid)) process.kill(pid, "SIGKILL");
  await new Promise((r) => setTimeout(r, 200));
  return pids.filter(alive);
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await run("orphans", async () => {
    const ps = spawnSync("ps", ["-Ao", "pid=,ppid=,etime=,command="], {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    });
    const found = orphansIn(ps.stdout ?? "", root, process.pid);
    if (!parseArgs().flags.has("kill")) {
      const diags = found.map((o) => ({
        kind: "diag",
        code: "O0001",
        message: `orphan pid ${o.pid}, running ${o.age}: ${o.command.replace(`${root}/`, "").slice(0, 120)}`,
        fix: "pnpm orphans --kill",
      }));
      return { diags, counts: { found: found.length } };
    }
    const left = await kill(found.map((o) => o.pid));
    const diags = left.map((pid) => ({
      kind: "diag",
      code: "O0001",
      message: `orphan pid ${pid} is still alive after SIGKILL`,
    }));
    return { diags, counts: { found: found.length, killed: found.length - left.length } };
  });
}
