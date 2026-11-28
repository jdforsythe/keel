// CI's test split (the `test-shard` job of tooling/ci.source.json). Every workspace package with a test task lands in
// exactly one shard; a package listed in SPLIT (ci-plan.ts) runs as that many parts (vitest's `--shard=i/k`, its files
// dealt by their recorded seconds through ci-sequencer.ts), each part in its own shard. The shard count is the length
// of that job's matrix. Packages and parts are dealt heaviest first, each to the shard with the least seconds so far.
// The seconds are tooling/ci-shards.json's, read from the shard logs of CI runs on the 4-core hosted runner: a
// package's test task as a whole, and each file of a split package with the package's parallel factor; a package not
// listed there weighs SECONDS_PER_FILE per test file, so a new package joins a shard without an edit here. Each test
// file prints a `file <path> <s>s` line as it ends; the shard run ends with one line per task (result, seconds,
// memory) and its slowest files, so the next times to record are in every log, and a task that runs past five minutes
// says so every five minutes with its memory.
// Usage: node tooling/ci-shards.mjs <shard>   runs that shard's test tasks through turbo, one task at a time, every
//                                            task even after one fails, streaming turbo's output; then a line per
//                                            task and, for each failed task, its name and its whole log
//        node tooling/ci-shards.mjs --browser <shard>  prints `browser=true` when a package of that shard has a
//                                            test file that drives a browser (BROWSER below), else `browser=false`,
//                                            for $GITHUB_OUTPUT: only those shards install Chromium
//        node tooling/ci-shards.mjs --plan    prints each shard's packages and parts and expected seconds
//        node tooling/ci-shards.mjs --verify  fails E0013 when a test task or a part of a split one falls in no
//                                            shard or in two, two parts of one package share a shard, the matrix
//                                            does not count 1 to n or test-macos.source.json's differs, a shard's expected seconds pass BUDGET of the
//                                            job's `timeout-minutes`, or the times or SPLIT name a package with no
//                                            test task
//        node tooling/ci-shards.mjs --refresh <run-id>...  rewrites tooling/ci-shards.json from those CI runs'
//                                            test-shard logs (`gh run view`): per task and file the most any run
//                                            took; the test tasks no run timed are listed
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./output.ts";
import {
  deal as dealUnits,
  label,
  mergeTimes,
  parseShardLog,
  readTimes,
  SECONDS_PER_FILE,
  SPLIT,
  units,
  WORKERS,
} from "./ci-plan.ts";
import { dryRunJson } from "./turbo-dry.mjs";

const root = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", "fixtures", "reports", "coverage"]);
const TEST = /\.test\.[cm]?[jt]sx?$/;
/** What a test or conformance file that drives a browser names: Playwright, the e2e entry, or `keel test --e2e`. */
const BROWSER = /from ["']playwright|@keel\/testing\/e2e|keelE2e\(|\["test", "--e2e"/;

/** The test files of the package at `dir` as its vitest lists them, relative to `dir`. */
function testFiles(dir) {
  const r = spawnSync("pnpm", ["exec", "vitest", "list", "--filesOnly"], {
    cwd: path.join(root, dir),
    encoding: "utf8",
    env,
  });
  if (r.status !== 0) throw new Error(`vitest list failed in ${dir}: ${r.stderr.trim().split("\n").at(-1)}`);
  return r.stdout
    .split("\n")
    .filter((l) => TEST.test(l.trim()))
    .map((l) => l.trim());
}

/** Whether a unit (a package, or one part of a split one) runs a test file that drives a browser. */
function drivesBrowser(dir, unit) {
  const mine = unit.files ?? testFiles(dir);
  return mine.some((f) => BROWSER.test(fs.readFileSync(path.join(root, dir, f), "utf8")));
}
const env = { ...process.env, TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" };
const GB = 2 ** 30;
/** How often a running task's process tree and the machine's free memory are sampled. */
const SAMPLE_MS = 5000;
/** How often a running task reports that it still runs, with its memory, so a runner lost mid-task shows both. */
const STILL_MS = 300_000;

const shardJob = JSON.parse(fs.readFileSync(path.join(root, "tooling/ci.source.json"), "utf8")).jobs["test-shard"];
const matrix = shardJob.strategy.matrix.shard;
/** The share of the job's time limit a shard's expected seconds may take: runs vary, and setup comes first. */
const BUDGET = 0.6;
const limit = shardJob["timeout-minutes"] * 60;
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
  return dryRunJson(r.stdout)
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

/** Every package's test task with its test-file count, a split package's with its test files. */
const planned = (tasks) =>
  tasks.map((t) => ({
    ...t,
    testFiles: countTests(path.join(root, t.dir)),
    ...(SPLIT[t.name] === undefined ? {} : { files: testFiles(t.dir) }),
  }));

/** The shards of these test tasks, by the recorded times. */
const deal = (tasks) => dealUnits(units(planned(tasks), readTimes()), n);

const filters = (names) => [...new Set(names)].map((p) => `--filter=${p}`);
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

/** What follows `--` on a unit's test task: its part of a split package and its worker limit. */
function vitestArgs(unit) {
  const args = [
    ...(unit.parts === 1 ? [] : [`--shard=${unit.part}/${unit.parts}`]),
    ...(WORKERS[unit.name] === undefined ? [] : [`--maxWorkers=${WORKERS[unit.name]}`]),
  ];
  return args.length === 0 ? [] : ["--", ...args];
}

/**
 * Runs one package's test task through turbo, its output streamed as it comes and kept for the closing report.
 * Resolves with the task's exit code, seconds, its process tree's peak memory and the machine's least free memory.
 */
function runTask(unit, state) {
  const name = label(unit);
  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn(
      "pnpm",
      [
        "exec",
        "turbo",
        "run",
        "test",
        `--filter=${unit.name}`,
        "--concurrency=1",
        "--output-logs=new-only",
        "--log-order=stream",
        "--ui=stream",
        "--no-color",
        // Lets KEEL_FILE_TIMES reach vitest (tooling/vitest-config.ts prints a line per test file with it).
        "--env-mode=loose",
        ...vitestArgs(unit),
      ],
      { cwd: root, env: { ...env, KEEL_FILE_TIMES: "1" }, stdio: ["ignore", "pipe", "pipe"] },
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

/** The `file <path> <s>s` lines of a task's log, slowest first, at most `k`. */
function slowest(log, k) {
  const files = [];
  for (const m of log.matchAll(/\bfile (\S+) (\d+(?:\.\d+)?)s$/gm)) files.push({ path: m[1], s: Number(m[2]) });
  return files
    .sort((a, b) => b.s - a.s)
    .slice(0, k)
    .map((f) => `${f.path} ${f.s.toFixed(1)}s`);
}

const line = (r) => {
  const head =
    `${r.code === 0 ? "ok" : "fail"} ${r.name} test ${r.seconds.toFixed(1)}s` +
    `${r.signal ? ` ${r.signal}` : r.code === 0 ? "" : ` exit ${r.code}`}, peak ${gb(r.peak)}, least free ${gb(r.least)}`;
  const files = slowest(r.log, 5);
  return files.length === 0 ? head : `${head}\n  slowest: ${files.join(", ")}`;
};

const arg = process.argv[2];

if (arg === "--verify") {
  await run("ci-shards", () => {
    const diags = [];
    const fail = (message) => diags.push({ kind: "diag", code: "E0013", path: "tooling/ci.source.json", message });
    if (matrix.some((s, i) => s !== i + 1)) fail(`test-shard matrix is ${JSON.stringify(matrix)}, not 1 to ${n}`);
    const macos = JSON.parse(fs.readFileSync(path.join(root, "tooling/test-macos.source.json"), "utf8")).jobs[
      "test-macos"
    ].strategy.matrix.shard;
    if (JSON.stringify(macos) !== JSON.stringify(matrix))
      diags.push({
        kind: "diag",
        code: "E0013",
        path: "tooling/test-macos.source.json",
        message: `test-macos matrix is ${JSON.stringify(macos)}, not the test-shard matrix ${JSON.stringify(matrix)}`,
      });
    const tasks = testTasks();
    const all = tasks.map((t) => t.name);
    // Each shard's filters go through turbo, so a package counts where turbo would run it; a split package's parts
    // count by the part each shard runs.
    const seen = new Map();
    for (const [i, s] of deal(tasks).entries()) {
      const names = s.units.map((u) => u.name);
      for (const name of names.length === 0 ? [] : testTasks(filters(names)).map((t) => t.name)) {
        const parts = s.units.filter((u) => u.name === name);
        for (const u of parts.length === 0 ? [{ name, part: 1, parts: 1 }] : parts)
          seen.set(label(u), [...(seen.get(label(u)) ?? []), i + 1]);
      }
    }
    const shards = deal(tasks);
    for (const [i, s] of shards.entries())
      if (s.seconds > BUDGET * limit)
        fail(`shard ${i + 1}/${n} expects ${s.seconds}s, over ${BUDGET * 100}% of the job's ${limit}s limit`);
    const expected = units(planned(tasks), readTimes()).map(label);
    for (const unit of expected) {
      const at = seen.get(unit) ?? [];
      if (at.length !== 1)
        fail(`${unit} runs its tests in ${at.length === 0 ? "no shard" : `shards ${at.join(", ")}`}`);
    }
    for (const unit of seen.keys()) if (!expected.includes(unit)) fail(`${unit} is in a shard but has no test task`);
    for (const [name, parts] of Object.entries(SPLIT)) {
      const shards = expected.filter((u) => u.startsWith(`${name} `)).map((u) => (seen.get(u) ?? [])[0]);
      if (new Set(shards).size !== shards.length) fail(`two parts of ${name} share a shard: ${shards.join(", ")}`);
      if (!Number.isInteger(parts) || parts < 2 || parts > n) fail(`SPLIT gives ${name} ${parts} parts, not 2 to ${n}`);
    }
    const times = readTimes();
    for (const [table, file, names] of [
      ["the times", "tooling/ci-shards.json", [...Object.keys(times.packages), ...Object.keys(times.files)]],
      ["SPLIT", "tooling/ci-plan.ts", Object.keys(SPLIT)],
    ])
      for (const name of names)
        if (!all.includes(name))
          diags.push({
            kind: "diag",
            code: "E0013",
            path: file,
            message: `${table} list ${name}, which has no test task`,
          });
    return { diags, counts: { packages: all.length, parts: expected.length, shards: n } };
  });
} else if (arg === "--refresh") {
  await run("ci-shards refresh", () => {
    const ids = process.argv.slice(3);
    if (ids.length === 0)
      return { diags: [{ kind: "diag", code: "E0013", message: "--refresh takes one or more run ids" }], counts: {} };
    const gh = (args) => {
      const r = spawnSync("gh", args, { cwd: root, encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });
      if (r.status !== 0) throw new Error(`gh ${args.join(" ")} failed: ${r.stderr.trim().split("\n").at(-1)}`);
      return r.stdout;
    };
    const logs = [];
    for (const id of ids) {
      const { jobs } = JSON.parse(gh(["run", "view", id, "--json", "jobs"]));
      for (const job of jobs.filter((j) => j.name.startsWith("test-shard")))
        logs.push(parseShardLog(gh(["run", "view", "--job", String(job.databaseId), "--log"])));
    }
    const times = mergeTimes(ids, logs);
    const out = path.join(root, "tooling/ci-shards.json");
    fs.writeFileSync(out, `${JSON.stringify(times, null, 2)}\n`);
    // The repository's formatter (tooling/format-check.mjs) has the last word on the file's layout.
    spawnSync("pnpm", ["exec", "biome", "format", "--write", "tooling/ci-shards.json"], {
      cwd: root,
      env,
      stdio: "ignore",
    });
    const untimed = testTasks()
      .map((t) => t.name)
      .filter((name) => times.packages[name] === undefined && times.files[name] === undefined);
    for (const name of untimed) say(`untimed ${name}: weighs ${SECONDS_PER_FILE}s per test file`);
    return {
      diags: [],
      counts: {
        runs: ids.length,
        logs: logs.length,
        packages: Object.keys(times.packages).length,
        untimed: untimed.length,
      },
    };
  });
} else if (arg === "--browser") {
  const shard = Number(process.argv[3]);
  const tasks = testTasks();
  const mine = deal(tasks)[shard - 1]?.units ?? [];
  const dirs = new Map(tasks.map((t) => [t.name, t.dir]));
  const needs = mine.some((u) => drivesBrowser(dirs.get(u.name) ?? "", u));
  process.stdout.write(`browser=${needs}\n`);
} else if (arg === "--plan") {
  await run("ci-shards plan", () => {
    for (const [i, s] of deal(testTasks()).entries())
      say(`shard ${i + 1}/${n} ${s.seconds}s: ${s.units.map(label).join(", ")}`);
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
    const { units: mine, seconds } = deal(testTasks())[shard - 1];
    say(
      `shard ${shard}/${n} on ${os.availableParallelism()} cores, ${gb(os.totalmem())}, ` +
        `expected ${seconds}s: ${mine.map(label).join(", ")}`,
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
    for (const unit of mine) {
      say(`run ${label(unit)} test`);
      done.push(await runTask(unit, state));
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
      counts: { tasks: mine.length, failed: failed.length },
      exit: failed.length === 0 ? 0 : 1,
    };
  });
}
