// The one way a mutation run starts, is watched and is stopped.
//   node ../../tooling/mutate.mjs [stryker args]   run Stryker for the package in the current directory
//   node tooling/mutate.mjs --status               one line per live run
//   node tooling/mutate.mjs --stop                 one SIGINT to every live run this runner started
// A run over its time budget (tooling/budgets.json `mutate`, minutes) gets one SIGINT: Stryker saves what it has
// tested to the shared cache and the next run resumes from there.
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mutateCacheDir } from "./mutate-cache.ts";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const RUN = path.join(".stryker-tmp", "run.json");
const PROGRESS = path.join(".stryker-tmp", "progress.json");
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
  if (typeof v !== "number" || !(v > 0)) throw new Error("tooling/budgets.json: mutate.default must be minutes above 0");
  return v;
}

/** `check 5,120 of 8,634 mutants, 3,100 reused, 41 a minute, about 14m left`. */
export function statusLine(pkg, p, now) {
  const n = (v) => v.toLocaleString("en-US");
  const ran = Math.max(0, p.tested - p.reused);
  const minutes = (now - p.startedAt) / 60000;
  const rate = minutes > 0 ? ran / minutes : 0;
  const left = p.total - Math.max(p.tested, p.reused);
  const eta = rate > 0 ? `about ${Math.ceil(left / rate)}m left` : "no rate yet";
  return `${pkg} ${n(p.tested)} of ${n(p.total)} mutants, ${n(p.reused)} reused, ${Math.round(rate)} a minute, ${eta}`;
}

/** True when `pid` is alive and is Stryker (it titles its process `stryker`): the only processes this runner signals. */
function isStryker(pid) {
  const r = spawnSync("ps", ["-p", String(pid), "-o", "command="], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim() === "stryker";
}

/** Packages with a live run started by this runner: `{ pkg, dir, pid }`. */
function liveRuns() {
  const pk = path.join(root, "packages");
  const out = [];
  for (const pkg of fs.readdirSync(pk).sort()) {
    const dir = path.join(pk, pkg);
    const r = readJson(path.join(dir, RUN));
    if (r && Number.isInteger(r.pid) && isStryker(r.pid)) out.push({ pkg, dir, pid: r.pid });
  }
  return out;
}

function status() {
  return run("mutate-status", () => {
    const live = liveRuns();
    for (const { pkg, dir } of live) {
      const p = readJson(path.join(dir, PROGRESS));
      console.log(p?.total ? statusLine(pkg, p, Date.now()) : `${pkg} dry run`);
    }
    return { diags: [], counts: { running: live.length } };
  });
}

function stop() {
  return run("mutate-stop", () => {
    const live = liveRuns();
    for (const { pid } of live) process.kill(pid, "SIGINT");
    return { diags: [], counts: { stopped: live.length } };
  });
}

function mutate(args) {
  const pkg = path.basename(process.cwd());
  const live = readJson(RUN);
  if (live && Number.isInteger(live.pid) && isStryker(live.pid)) {
    console.log(`fail mutate ${pkg} a run is live here (pnpm mutate:status, pnpm mutate:stop)`);
    process.exitCode = 1;
    return;
  }
  const budget = budgetMinutes(readJson(path.join(import.meta.dirname, "budgets.json")), pkg);
  const bin = path.join(root, "node_modules", "@stryker-mutator", "core", "bin", "stryker.js");
  const t0 = Date.now();
  fs.mkdirSync(".stryker-tmp", { recursive: true });
  fs.rmSync(PROGRESS, { force: true });
  // A run that was interrupted leaves its sandbox copy behind; no run of this package is live here.
  for (const d of fs.readdirSync(".stryker-tmp"))
    if (d.startsWith("sandbox-")) fs.rmSync(path.join(".stryker-tmp", d), { recursive: true, force: true });
  const child = spawn(process.execPath, [bin, "run", ...args], {
    stdio: "inherit",
    env: { ...process.env, KEEL_TEST_TIMES: path.join(mutateCacheDir(), `${pkg}.times.json`) },
  });
  fs.writeFileSync(RUN, JSON.stringify({ pid: child.pid, startedAt: t0 }));
  let over = false;
  const timer = setTimeout(() => {
    over = true;
    child.kill("SIGINT");
  }, budget * 60000);
  // A terminal's Ctrl-C reaches the child by itself; the runner stays up until Stryker has saved and left.
  process.on("SIGINT", () => {});
  process.on("SIGTERM", () => child.kill("SIGINT"));
  child.on("exit", (code, signal) => {
    clearTimeout(timer);
    fs.rmSync(RUN, { force: true });
    if (code === 0 && !over) return;
    const interrupted = over || signal !== null || code === 130;
    if (!interrupted) {
      // Stryker printed its own trailer (score under the floor) or its own error.
      process.exitCode = code ?? 1;
      return;
    }
    const p = readJson(PROGRESS) ?? { tested: 0, total: 0 };
    const why = over ? `time budget ${budget}m reached` : "stopped";
    if (process.env.KEEL_FORMAT === "json")
      console.log(
        JSON.stringify({
          kind: "summary",
          ok: false,
          name: `mutate ${pkg}`,
          counts: { tested: p.tested, total: p.total, budgetMinutes: budget },
          ms: Date.now() - t0,
        }),
      );
    else
      console.log(
        `fail mutate ${pkg} ${why} at ${p.tested.toLocaleString("en-US")} of ${p.total.toLocaleString("en-US")} mutants; run again to resume`,
      );
    process.exitCode = 1;
  });
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  if (args[0] === "--status") await status();
  else if (args[0] === "--stop") await stop();
  else mutate(args);
}
