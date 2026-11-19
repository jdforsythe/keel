// The one way a mutation run starts, is watched and is stopped.
//   node ../../tooling/mutate.mjs [stryker args]   run Stryker for the package in the current directory
//   node tooling/mutate.mjs --status               one line per live run
//   node tooling/mutate.mjs --stop                 one SIGINT to every live run's process group, then waits for it
// Stryker runs in its own process group (the core and the test runners it starts). A run over its time budget
// (tooling/budgets.json `mutate`, minutes) gets one SIGINT to that group: Stryker saves what it has tested to the
// shared cache and the next run resumes from there. Stryker exits without saving on a second signal, so every
// signal goes through the run file `<cache>/<pkg>.run.json`: whoever marks it `signalled` first sends the SIGINT
// and nobody sends another. A group still alive GRACE_S after its SIGINT is killed (SIGKILL), and every ending is
// checked by PID: the summary line says whether any process of the group is left.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mutateCacheDir } from "./mutate-cache.ts";
import { acquire, lockedDiag } from "./mutateLock.mjs";
import { mode, quiet, run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const PROGRESS = path.join(".stryker-tmp", "progress.json");
/** Seconds Stryker has to save and leave after its SIGINT before the runner kills the child it started. */
const GRACE_S = 120;
/**
 * The test watchdog's grace (tooling/watchdog.ts) under a mutation run, in milliseconds. Stryker's own timeout ends a
 * mutant that never finishes and counts it as detected; a test runner the watchdog kills first is a crash, which
 * Stryker runs again and then reports as a runtime error. Ten minutes is longer than any mutant's timeout, so the
 * watchdog only ends a runner Stryker has lost.
 */
const WATCHDOG_GRACE_MS = 10 * 60000;
/** Milliseconds with no mutant finished before a run is stalled (E0011); `KEEL_MUTATE_STALL_MS` shortens it for tests. */
const stallMs = () => Number(process.env.KEEL_MUTATE_STALL_MS) || 10 * 60000;
/** Milliseconds between the runner's looks at its run (stop requests, stall); `KEEL_MUTATE_POLL_MS` shortens it for tests. */
const pollMs = () => Number(process.env.KEEL_MUTATE_POLL_MS) || 5000;
const json = () => mode() === "json" || process.env.KEEL_FORMAT === "json";
const n = (v) => v.toLocaleString("en-US");
const readJson = (f) => {
  try {
    return JSON.parse(fs.readFileSync(f, "utf8"));
  } catch {
    return undefined;
  }
};

/** Minutes a run of `pkg` may take: its own entry in `budgets.mutate`, else `default`. */
export function budgetMinutes(budgets, pkg) {
  const m = budgets?.mutate ?? {};
  const v = m[`@keel/${pkg}`] ?? m.default;
  if (typeof v !== "number" || !(v > 0))
    throw new Error("tooling/budgets.json: mutate.default must be minutes above 0");
  return v;
}

/** `check 5,120 of 8,634 mutants, 3,100 reused, 41 a minute, about 14m left`. */
export function statusLine(pkg, p, now) {
  const ran = Math.max(0, p.tested - p.reused);
  const minutes = (now - p.startedAt) / 60000;
  const rate = minutes > 0 ? ran / minutes : 0;
  const left = p.total - Math.max(p.tested, p.reused);
  const eta = rate > 0 ? `about ${Math.ceil(left / rate)}m left` : "no rate yet";
  return `${pkg} ${n(p.tested)} of ${n(p.total)} mutants, ${n(p.reused)} reused, ${Math.round(rate)} a minute, ${eta}`;
}

/**
 * The stall clock: `state` is `{ tested, since }`, `p` the run's progress file (undefined before its first write).
 * Returns the next state and whether the run has gone `limitMs` without a finished mutant. Before the first
 * progress the clock runs from `state.since`, so a hung dry run is cut off too.
 */
export function stallCheck(state, p, now, limitMs) {
  const tested = p?.tested ?? -1;
  const next = tested === state.tested ? state : { tested, since: now };
  return { state: next, stalled: now - next.since >= limitMs };
}

/** How a run that did not finish ended: `budget`, `stopped`, or `crashed` (a signal nobody here sent). */
export function ending({ over, signalled, code, signal }) {
  if (over) return "budget";
  if (signalled || code === 130 || signal === "SIGINT") return "stopped";
  return "crashed";
}

/** Pids in process group `pgid`, from a `ps -A -o pid=,pgid=` listing. */
export function groupMembers(listing, pgid) {
  const out = [];
  for (const line of listing.split("\n")) {
    const [pid, group] = line.trim().split(/\s+/).map(Number);
    if (Number.isInteger(pid) && group === pgid) out.push(pid);
  }
  return out;
}

/** The live processes of group `pgid`. */
export function listGroup(pgid) {
  const r = spawnSync("ps", ["-A", "-o", "pid=,pgid="], { encoding: "utf8" });
  return r.status === 0 ? groupMembers(r.stdout, pgid) : [];
}

/** Sends `signal` to group `pgid`; false when the group is already gone. */
export function signalGroup(pgid, signal) {
  try {
    process.kill(-pgid, signal);
    return true;
  } catch {
    return false;
  }
}

/** `no process left` or `2 processes left (pids 41,42)`: the PID check every ending reports. */
export function leftNote(left) {
  if (left.length === 0) return "no process left";
  return `${left.length} process${left.length === 1 ? "" : "es"} left (pids ${left.join(",")})`;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Waits up to `graceMs` for group `pgid` to empty, then SIGKILLs what remains and waits up to `killMs` more.
 * `{ killed, left }`: whether the SIGKILL was sent, and the pids still alive at the end.
 */
export async function endGroup(pgid, { graceMs = GRACE_S * 1000, killMs = 5000, pollMs = 500, beforeKill } = {}) {
  const until = (deadline) => async () => {
    while (listGroup(pgid).length > 0 && Date.now() < deadline) await sleep(pollMs);
  };
  await until(Date.now() + graceMs)();
  if (listGroup(pgid).length === 0) return { killed: false, left: [] };
  beforeKill?.();
  signalGroup(pgid, "SIGKILL");
  await until(Date.now() + killMs)();
  return { killed: true, left: listGroup(pgid) };
}

const command = (pid) => {
  const r = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : "";
};
/** True while the run in `r` (a run file's content) is alive: its Stryker child, or its runner before the child exists. */
function isLive(r) {
  if (!r) return false;
  // Stryker titles its process `stryker` once it is up; before that the command line names its bin.
  if (Number.isInteger(r.pid)) return /^stryker$|bin\/stryker\.js/.test(command(r.pid));
  return Number.isInteger(r.runner) && /tooling\/mutate\.mjs/.test(command(r.runner));
}

/** Live runs in the shared cache: `{ pkg, file, ...run file }`. */
function liveRuns() {
  const dir = mutateCacheDir(root);
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith(".run.json")) continue;
    const file = path.join(dir, f);
    const r = readJson(file);
    if (isLive(r)) out.push({ ...r, pkg: f.slice(0, -".run.json".length), file });
  }
  return out;
}

/** Marks the run file `signalled`; false when it already is, so the caller sends nothing. */
/**
 * A link `<root>/.stryker-tmp/<name>` to every `packages/<name>`. A sandbox under the repository root's `.stryker-tmp`
 * (`ROOT_SANDBOX`, tooling/stryker.mjs) sits beside those links as a package sits beside its siblings, so a test or a
 * process it starts that reaches `../../<name>/src/index.ts` from its own directory finds the sibling's source.
 */
export function linkPackages(repo) {
  const home = path.join(repo, ".stryker-tmp");
  fs.mkdirSync(home, { recursive: true });
  for (const e of fs.readdirSync(path.join(repo, "packages"), { withFileTypes: true })) {
    if (!e.isDirectory() || e.name.startsWith(".")) continue;
    const link = path.join(home, e.name);
    if (fs.lstatSync(link, { throwIfNoEntry: false })) continue;
    fs.symlinkSync(path.join("..", "packages", e.name), link, "dir");
  }
}

function claimSignal(file) {
  const r = readJson(file);
  if (!r || r.signalled) return false;
  fs.writeFileSync(file, JSON.stringify({ ...r, signalled: true }));
  return true;
}

function status() {
  return run("mutate-status", () => {
    const live = liveRuns();
    for (const r of live) {
      const p = readJson(path.join(r.dir, PROGRESS));
      if (json())
        console.log(JSON.stringify({ kind: "mutate.run", pkg: r.pkg, dir: path.relative(root, r.dir), ...p }));
      else if (!quiet()) console.log(p?.total ? statusLine(r.pkg, p, Date.now()) : `${r.pkg} dry run`);
    }
    return { diags: [], counts: { running: live.length } };
  });
}

/** The file `mutate-changed` reads between packages: a stop ends its whole sequence, not just the live run. */
export const stopFile = (cache) => path.join(cache, "stop.json");

function stop() {
  return run("mutate-stop", async () => {
    fs.mkdirSync(mutateCacheDir(root), { recursive: true });
    fs.writeFileSync(stopFile(mutateCacheDir(root)), JSON.stringify({ at: Date.now() }));
    // A run another stop or its budget already signalled is waited for too, but gets no second SIGINT.
    const runs = liveRuns().filter((r) => Number.isInteger(r.pid));
    let stopped = 0;
    for (const r of runs) if (claimSignal(r.file) && signalGroup(r.pid, "SIGINT")) stopped++;
    const ends = await Promise.all(
      runs.map((r) =>
        endGroup(r.pid, {
          beforeKill: () => fs.writeFileSync(r.file, JSON.stringify({ ...readJson(r.file), killed: true })),
        }),
      ),
    );
    const killed = ends.filter((e) => e.killed).length;
    const left = ends.flatMap((e) => e.left);
    const line = `ok mutate-stop ${stopped} stopped, ${killed} killed, ${leftNote(left)}`;
    const diags = left.map((pid) => ({ kind: "diag", code: "M0001", message: `process ${pid} survived SIGKILL` }));
    return { diags, counts: { stopped, killed, left: left.length }, line };
  });
}

function mutate(args) {
  const pkg = path.basename(process.cwd());
  const fail = (text, counts = {}, diag) => {
    const ms = Date.now() - t0;
    if (diag && json()) console.log(JSON.stringify({ kind: "diag", ...diag }));
    else if (diag) console.log(`${diag.code} ${diag.message}`);
    if (json()) console.log(JSON.stringify({ kind: "summary", ok: false, name: `mutate ${pkg}`, counts, ms }));
    else console.log(`fail mutate ${pkg} ${text} (${(ms / 1000).toFixed(1)}s)`);
    process.exitCode = 1;
  };
  const t0 = Date.now();
  // One mutation run on the machine; the packages `pnpm mutate` runs one after the other are its descendants and pass.
  const lock = acquire();
  if (!lock.held) return fail("not started", {}, lockedDiag(lock.holder));
  const budget = budgetMinutes(readJson(path.join(import.meta.dirname, "budgets.json")), pkg);
  const cache = mutateCacheDir();
  const file = path.join(cache, `${pkg}.run.json`);
  fs.mkdirSync(cache, { recursive: true });
  // One run of a package per clone: the cache file is shared by every worktree. `wx` makes the claim atomic.
  const claim = () =>
    fs.writeFileSync(file, JSON.stringify({ runner: process.pid, dir: process.cwd(), startedAt: t0 }), { flag: "wx" });
  try {
    claim();
  } catch {
    if (isLive(readJson(file))) return fail("a run of this package is live (pnpm mutate:status, pnpm mutate:stop)");
    fs.rmSync(file, { force: true });
    claim();
  }
  fs.mkdirSync(".stryker-tmp", { recursive: true });
  fs.rmSync(PROGRESS, { force: true });
  // A run that was interrupted leaves its sandbox copy behind, here or under the repository root; this run holds the
  // machine-wide lock, so no sandbox is in use.
  for (const home of [".stryker-tmp", path.join(root, ".stryker-tmp")]) {
    if (!fs.existsSync(home)) continue;
    for (const d of fs.readdirSync(home))
      if (d.startsWith("sandbox-")) fs.rmSync(path.join(home, d), { recursive: true, force: true });
  }
  linkPackages(root);

  const bin =
    process.env.KEEL_MUTATE_BIN || path.join(root, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js");
  // `pnpm test` starts vitest through pnpm's bin shim, which puts pnpm's hoisted packages on NODE_PATH; Stryker starts
  // its test runners without the shim, so the same directory is named here and a test resolves what it does there.
  const NODE_PATH = process.env.NODE_PATH || path.join(root, "node_modules", ".pnpm", "node_modules");
  // Its own process group: a terminal's Ctrl-C reaches the runner only, which passes on exactly one SIGINT.
  const child = spawn(process.execPath, [bin, "run", ...args], {
    stdio: "inherit",
    detached: true,
    env: {
      KEEL_WATCHDOG_GRACE_MS: String(WATCHDOG_GRACE_MS),
      ...process.env,
      NODE_PATH,
      KEEL_TEST_TIMES: path.join(cache, `${pkg}.times.json`),
      KEEL_MUTATE_RUN: file,
    },
  });
  let over = false;
  let killed = false;
  let grace;
  const armGrace = () => {
    grace ??= setTimeout(() => {
      killed = true;
      signalGroup(child.pid, "SIGKILL");
    }, GRACE_S * 1000);
  };
  const interrupt = () => {
    if (claimSignal(file)) signalGroup(child.pid, "SIGINT");
    armGrace();
  };
  const timer = setTimeout(() => {
    over = true;
    interrupt();
  }, budget * 60000);
  // `mutate:stop` signals the group itself; the runner still owes it the grace period.
  // A run with no mutant finished for `stallMs()` is stalled: it gets the same one SIGINT as a run over budget.
  let stalled = false;
  let stall = { tested: -2, since: Date.now() };
  const watch = setInterval(() => {
    if (readJson(file)?.signalled) armGrace();
    if (stalled) return;
    const s = stallCheck(stall, readJson(PROGRESS), Date.now(), stallMs());
    stall = s.state;
    if (s.stalled) {
      stalled = true;
      interrupt();
    }
  }, pollMs());
  const done = () => {
    clearTimeout(timer);
    clearTimeout(grace);
    clearInterval(watch);
  };
  for (const s of ["SIGINT", "SIGTERM", "SIGHUP"]) process.on(s, interrupt);
  child.on("error", (e) => {
    done();
    fs.rmSync(file, { force: true });
    fail(`Stryker did not start: ${e.message}`);
  });
  child.on("spawn", () => fs.writeFileSync(file, JSON.stringify({ ...readJson(file), pid: child.pid })));
  // The runner never leaves the group behind, whichever way it exits.
  process.on("exit", () => signalGroup(child.pid, "SIGKILL"));
  child.on("exit", async (code, signal) => {
    done();
    const claimed = readJson(file);
    const signalled = claimed?.signalled === true;
    killed ||= claimed?.killed === true;
    stalled &&= code !== 0;
    // Test runners Stryker started can outlive it; the group ends with its core, checked by PID.
    const { left } = await endGroup(child.pid, { graceMs: code === 0 ? 0 : 5000 });
    fs.rmSync(file, { force: true });
    if (code === 0) {
      if (left.length > 0) fail(`finished, but ${leftNote(left)}`);
      return;
    }
    const p = readJson(PROGRESS) ?? { tested: 0, total: 0 };
    const counts = { tested: p.tested, total: p.total, budgetMinutes: budget };
    const at = `at ${n(p.tested)} of ${n(p.total)} mutants`;
    const gone = leftNote(left);
    if (stalled) {
      const diag = { code: "E0011", message: `mutation run stalled at ${p.tested}/${p.total} mutants` };
      return fail(
        `no mutant finished for ${Math.round(stallMs() / 60000)}m; run again to resume; ${gone}`,
        counts,
        diag,
      );
    }
    // 130 tells `mutate-changed` the run was stopped or killed on purpose, so it starts no further package.
    if (killed) {
      fail(`did not stop within ${GRACE_S}s of its SIGINT and was killed ${at}; nothing saved; ${gone}`, counts);
      process.exitCode = over ? 1 : 130;
      return;
    }
    const how = ending({ over, signalled, code, signal });
    if (how === "budget")
      return fail(`time budget ${budget}m reached ${at}; run again to resume; ${gone}`, { ...counts, overBudget: 1 });
    if (how === "stopped") {
      fail(`stopped ${at}; run again to resume; ${gone}`, { ...counts, stopped: 1 });
      process.exitCode = 130;
      return;
    }
    // Stryker printed its own trailer (score under the floor) or its own error; a signal from elsewhere is a crash.
    if (signal) fail(`Stryker ended on ${signal} ${at}; nothing saved; ${gone}`, counts);
    else process.exitCode = code ?? 1;
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  if (args.includes("--status")) await status();
  else if (args.includes("--stop")) await stop();
  else mutate(args);
}
