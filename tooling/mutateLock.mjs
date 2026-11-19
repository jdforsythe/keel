// The machine-wide mutation lock: `os.tmpdir()/keel-mutate.lock` holds the pid of the process that owns the run.
// `pnpm mutate`, `pnpm mutate:changed` and a package's `mutate` script take it; a second taker gets E0010.
// A process started by the holder (the packages `pnpm mutate` runs one at a time) passes: the holder is its ancestor.
// A lock whose pid is gone, or is no mutation command any more (a reused pid), is taken over.
// `pnpm test` only reads it (`heldBy`), for W0012; `pnpm check` never does.
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

/** The lock file; `KEEL_MUTATE_LOCK` names another one (the tests do). */
export const lockFile = () => process.env.KEEL_MUTATE_LOCK || path.join(os.tmpdir(), "keel-mutate.lock");

const NAMED = /mutate/;

/** The command line of `pid`, or "" when it is gone. */
function commandOf(pid) {
  const r = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
}

/** True while `pid` is a live mutation command: alive, and its command line names `match`. */
export function holderAlive(pid, match = NAMED) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
  } catch (e) {
    if (e?.code !== "EPERM") return false;
  }
  return match.test(commandOf(pid));
}

/** The pids above `pid`, nearest first, from a `ps -A -o pid=,ppid=` listing. */
export function ancestors(listing, pid) {
  const parent = new Map();
  for (const line of listing.split("\n")) {
    const [p, pp] = line.trim().split(/\s+/).map(Number);
    if (Number.isInteger(p) && Number.isInteger(pp)) parent.set(p, pp);
  }
  const out = [];
  for (let at = parent.get(pid); at !== undefined && at > 1 && !out.includes(at); at = parent.get(at)) out.push(at);
  return out;
}

function ancestorPids() {
  const r = spawnSync("ps", ["-A", "-o", "pid=,ppid="], { encoding: "utf8" });
  return r.status === 0 ? ancestors(r.stdout, process.pid) : [];
}

const readPid = (file) => {
  try {
    const pid = Number(JSON.parse(fs.readFileSync(file, "utf8"))?.pid);
    return Number.isInteger(pid) ? pid : undefined;
  } catch {
    return undefined;
  }
};

/** The pid of the live run that holds the lock, else undefined. Reads only. */
export function heldBy(file = lockFile(), match = NAMED) {
  const pid = readPid(file);
  return pid !== undefined && holderAlive(pid, match) ? pid : undefined;
}

/**
 * Takes the lock. `{ held: true, release }` when this process owns it (or an ancestor does: `release` is then a
 * no-op), `{ held: false, holder }` when another live run does. The lock is released when the process exits.
 */
export function acquire({ file = lockFile(), pid = process.pid, match = NAMED, ancestry = ancestorPids } = {}) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      fs.writeFileSync(file, JSON.stringify({ pid, at: Date.now() }), { flag: "wx" });
      const release = () => {
        if (readPid(file) === pid) fs.rmSync(file, { force: true });
      };
      process.once("exit", release);
      return { held: true, release };
    } catch (e) {
      if (e?.code !== "EEXIST") throw e;
    }
    const holder = readPid(file);
    if (holder !== undefined && holderAlive(holder, match)) {
      if (holder === pid || ancestry().includes(holder)) return { held: true, release: () => {} };
      return { held: false, holder };
    }
    // Gone, or not a mutation run any more: take it over. A rival taker that wins the `wx` makes the next lap read its pid.
    if (readPid(file) === holder) fs.rmSync(file, { force: true });
  }
  return { held: false, holder: readPid(file) ?? 0 };
}

/** The E0010 record for a second run. */
export const lockedDiag = (holder) => ({
  kind: "diag",
  code: "E0010",
  message: `a mutation run is live (pid ${holder})`,
  fix: "wait for it, or stop it with pnpm mutate:stop",
});

/** The W0012 record for a test run that starts while a mutation run holds the machine. */
export const busyDiag = (holder) => ({
  kind: "diag",
  code: "W0012",
  message: `a mutation run is live (pid ${holder}); the tests run anyway and may time out`,
});
