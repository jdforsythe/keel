// CI's test split (the `test-shard` job of tooling/ci.source.json). Every workspace package with a test task lands in
// exactly one shard; the shard count is the length of that job's matrix. Packages are dealt heaviest first, each to the
// shard with the least weight so far. A package's weight is its test task's seconds on the 2-core hosted runner, from
// SECONDS below; a package not listed there weighs SECONDS_PER_FILE per test file, so a new package joins a shard
// without an edit here. The shard run ends with one line per task (result, seconds, memory), so the next times to
// record are in every log, and a task that runs past five minutes says so every five minutes with its memory.
// Usage: node tooling/ci-shards.mjs <shard>   runs that shard's test tasks through turbo, one task at a time, every
//                                            task even after one fails, streaming turbo's output; then a line per
//                                            task and, for each failed task, its name and its whole log
//        node tooling/ci-shards.mjs --plan    prints each shard's packages and expected seconds
//        node tooling/ci-shards.mjs --verify  fails E0013 when a test task falls in no shard, in two, the matrix
//                                            does not count 1 to n, or SECONDS names a package with no test task
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./output.ts";

const root = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", "fixtures", "reports", "coverage"]);
const TEST = /\.test\.[cm]?[jt]sx?$/;
const env = { ...process.env, TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" };
const GB = 2 ** 30;
/** How often a running task's process tree and the machine's free memory are sampled. */
const SAMPLE_MS = 5000;
/** How often a running task reports that it still runs, with its memory, so a runner lost mid-task shows both. */
const STILL_MS = 300_000;

/**
 * Seconds each test task takes on the 2-core, 7.7 GB hosted runner (vitest's own trailer in the shard logs, rounded
 * up). Packages under 10 s are left to the per-file weight. Update an entry from a shard's closing lines when its
 * task moves by more than a minute. `@keel/cli` holds the least it is known to take: its one measured run was cut at
 * 935 s (358 s on one worker of a 16-core laptop).
 */
const SECONDS = {
  "@keel/cli": 960,
  "@keel/std-sessions": 680,
  "@keel/check": 450,
  "@keel/scaffold": 270,
  "@keel/server": 210,
  "@keel/testing": 140,
  "@keel/std-conflicts": 120,
  "@keel/std-db": 90,
  "@keel/compiler": 70,
  "@keel/router": 65,
  "golden-1": 60,
  "@keel/std-credentials": 55,
  "golden-2": 35,
  "@keel/runtime-dom": 35,
  "@keel/ui": 35,
  "@keel/store": 30,
  "@keel/std-tables": 30,
  "@keel/forms": 25,
  "@keel/schema": 25,
  "@keel/std-workflows": 20,
  "@keel/std-jobs": 20,
  "@keel/services": 20,
  "@keel/tooling": 20,
  "@keel/std-channels": 15,
  "@keel/std-offline": 15,
  inspector: 15,
  "@keel/ctx": 15,
  "@keel/std-messages": 15,
  "@keel/std-statecharts": 15,
  "@keel/reactive": 10,
  "@keel/std-capacitor": 10,
  "@keel/std-tauri": 10,
  sessions: 10,
};
/** Weight per test file of a package SECONDS does not list. */
const SECONDS_PER_FILE = 1;

const matrix = JSON.parse(fs.readFileSync(path.join(root, "tooling/ci.source.json"), "utf8")).jobs["test-shard"]
  .strategy.matrix.shard;
const n = matrix.length;

/** Test tasks turbo plans for these filters (all packages when none). */
function testTasks(filters = []) {
  const r = spawnSync("pnpm", ["exec", "turbo", "run", "test", "--dry=json", ...filters], {
    cwd: root,
    encoding: "utf8",
    env,
    maxBuffer: 256 * 1024 * 1024,
  });
  if (r.status !== 0) throw new Error(`turbo --dry failed: ${r.stderr.trim().split("\n").at(-1)}`);
  return JSON.parse(r.stdout)
    .tasks.filter((t) => t.task === "test" && t.command !== "<NONEXISTENT>")
    .map((t) => ({ name: t.package, dir: t.directory }));
}

function countTests(dir) {
  let k = 0;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith(".") || SKIP.has(e.name)) continue;
    if (e.isDirectory()) k += countTests(path.join(dir, e.name));
    else if (TEST.test(e.name)) k += 1;
  }
  return k;
}

const weight = (t) => SECONDS[t.name] ?? SECONDS_PER_FILE * countTests(path.join(root, t.dir));

/** The shards, each its package names and expected seconds, dealt heaviest first to the lightest shard. */
function deal(tasks) {
  const weighed = tasks
    .map((t) => ({ name: t.name, w: weight(t) }))
    .sort((a, b) => b.w - a.w || a.name.localeCompare(b.name));
  const shards = Array.from({ length: n }, () => ({ w: 0, names: [] }));
  for (const p of weighed) {
    const lightest = shards.reduce((a, b) => (b.w < a.w ? b : a));
    lightest.w += p.w;
    lightest.names.push(p.name);
  }
  return shards.map((s) => ({ seconds: s.w, names: s.names.sort() }));
}

const filters = (names) => names.map((p) => `--filter=${p}`);
/** One line on stdout, written synchronously so it lands before an exit from a signal handler. */
const say = (text) => fs.writeSync(1, `${text}\n`);
const gb = (bytes) => `${(bytes / GB).toFixed(1)} GB`;

/** Resident bytes of `pid` and every process below it, from one `ps` listing; 0 when `ps` is unavailable. */
function treeRss(pid) {
  const r = spawnSync("ps", ["-A", "-o", "pid=,ppid=,rss="], { encoding: "utf8", timeout: 5000 });
  if (r.status !== 0) return 0;
  const kids = new Map();
  const rss = new Map();
  for (const line of r.stdout.split("\n")) {
    const [p, pp, kb] = line.trim().split(/\s+/).map(Number);
    if (!Number.isInteger(p) || !Number.isInteger(pp) || !Number.isInteger(kb)) continue;
    kids.set(pp, [...(kids.get(pp) ?? []), p]);
    rss.set(p, kb * 1024);
  }
  let sum = 0;
  const queue = [pid];
  for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
    sum += rss.get(next) ?? 0;
    queue.push(...(kids.get(next) ?? []));
  }
  return sum;
}

/**
 * Runs one package's test task through turbo, its output streamed as it comes and kept for the closing report.
 * Resolves with the task's exit code, seconds, its process tree's peak memory and the machine's least free memory.
 */
function runTask(name, state) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn(
      "pnpm",
      [
        "exec",
        "turbo",
        "run",
        "test",
        `--filter=${name}`,
        "--concurrency=1",
        "--output-logs=new-only",
        "--log-order=stream",
        "--ui=stream",
        "--no-color",
      ],
      { cwd: root, env, stdio: ["ignore", "pipe", "pipe"] },
    );
    const task = { name, t0, peak: 0, least: os.freemem(), log: [], child };
    state.running = task;
    const keep = (stream) => (chunk) => {
      task.log.push(chunk);
      stream.write(chunk);
    };
    child.stdout.on("data", keep(process.stdout));
    child.stderr.on("data", keep(process.stderr));
    const sample = setInterval(() => {
      task.peak = Math.max(task.peak, child.pid === undefined ? 0 : treeRss(child.pid));
      task.least = Math.min(task.least, os.freemem());
    }, SAMPLE_MS);
    const still = setInterval(() => {
      const s = ((performance.now() - t0) / 1000).toFixed(0);
      say(`still ${name} test ${s}s, peak ${gb(task.peak)}, least free ${gb(task.least)}`);
    }, STILL_MS);
    child.on("close", (code, signal) => {
      clearInterval(sample);
      clearInterval(still);
      state.running = undefined;
      resolve({
        name,
        code: code ?? 1,
        signal,
        seconds: (performance.now() - t0) / 1000,
        peak: task.peak,
        least: task.least,
        log: Buffer.concat(task.log).toString("utf8"),
      });
    });
  });
}

const line = (r) =>
  `${r.code === 0 ? "ok" : "fail"} ${r.name} test ${r.seconds.toFixed(1)}s` +
  `${r.signal ? ` ${r.signal}` : r.code === 0 ? "" : ` exit ${r.code}`}, peak ${gb(r.peak)}, least free ${gb(r.least)}`;

const arg = process.argv[2];

if (arg === "--verify") {
  await run("ci-shards", () => {
    const diags = [];
    const fail = (message) => diags.push({ kind: "diag", code: "E0013", path: "tooling/ci.source.json", message });
    if (matrix.some((s, i) => s !== i + 1)) fail(`test-shard matrix is ${JSON.stringify(matrix)}, not 1 to ${n}`);
    const tasks = testTasks();
    const all = tasks.map((t) => t.name);
    const seen = new Map();
    for (const [i, { names }] of deal(tasks).entries())
      for (const name of names.length === 0 ? [] : testTasks(filters(names)).map((t) => t.name))
        seen.set(name, [...(seen.get(name) ?? []), i + 1]);
    for (const name of all) {
      const at = seen.get(name) ?? [];
      if (at.length !== 1)
        fail(`${name} runs its tests in ${at.length === 0 ? "no shard" : `shards ${at.join(", ")}`}`);
    }
    for (const name of seen.keys()) if (!all.includes(name)) fail(`${name} is in a shard but has no test task`);
    for (const name of Object.keys(SECONDS))
      if (!all.includes(name))
        diags.push({
          kind: "diag",
          code: "E0013",
          path: "tooling/ci-shards.mjs",
          message: `SECONDS lists ${name}, which has no test task`,
        });
    return { diags, counts: { packages: all.length, shards: n } };
  });
} else if (arg === "--plan") {
  await run("ci-shards plan", () => {
    for (const [i, s] of deal(testTasks()).entries()) say(`shard ${i + 1}/${n} ${s.seconds}s: ${s.names.join(" ")}`);
    return { diags: [], counts: { shards: n } };
  });
} else {
  const shard = Number(arg);
  await run(`ci-shard ${arg}/${n}`, async () => {
    if (!Number.isInteger(shard) || shard < 1 || shard > n)
      return {
        diags: [{ kind: "diag", code: "E0013", message: `shard ${arg} is not between 1 and ${n}` }],
        counts: {},
      };
    const { names, seconds } = deal(testTasks())[shard - 1];
    say(
      `shard ${shard}/${n} on ${os.availableParallelism()} cores, ${gb(os.totalmem())}, ` +
        `expected ${seconds}s: ${names.join(" ")}`,
    );
    const state = { running: undefined };
    const done = [];
    // A cancelled or timed-out job signals the step: say what was running, for how long, and on how much memory.
    for (const signal of ["SIGINT", "SIGTERM"])
      process.once(signal, () => {
        for (const r of done) say(line(r));
        const t = state.running;
        if (t !== undefined)
          say(
            `cut ${t.name} test after ${((performance.now() - t.t0) / 1000).toFixed(1)}s by ${signal}, ` +
              `peak ${gb(t.peak)}, least free ${gb(t.least)}`,
          );
        t?.child.kill(signal);
        process.exit(signal === "SIGINT" ? 130 : 143);
      });
    for (const name of names) {
      say(`run ${name} test`);
      done.push(await runTask(name, state));
    }
    const failed = done.filter((r) => r.code !== 0);
    for (const r of done) say(line(r));
    for (const r of failed) say(`\nfailed: ${r.name} test, its whole log:\n${r.log}`);
    return {
      diags: failed.map((r) => ({
        kind: "diag",
        code: "E0005",
        message: `${r.name} test failed in shard ${shard}/${n} (${r.signal ?? `exit ${r.code}`})`,
      })),
      counts: { packages: names.length, failed: failed.length },
      exit: failed.length === 0 ? 0 : 1,
    };
  });
}
