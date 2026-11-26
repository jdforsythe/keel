// Wraps `turbo run <task>` so success is one trailer line and failure is only the failing packages' logs.
// Usage: node tooling/turbo.mjs <task> [turbo args...]
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { acquire, busyDiag, heldBy, lockedDiag } from "./mutateLock.mjs";
import { run } from "./output.ts";
import { testSlots } from "./test-slots.mjs";
import { failVerdict, taskFailures, turboVerdict } from "./turbo-verdict.mjs";

const ROOT = new URL("..", import.meta.url).pathname;

/** Each workspace package's name and its directory relative to the repository. */
function workspaceDirs(root) {
  /** @type {Record<string, string>} */
  const dirs = {};
  const tops = ["packages", "apps", "examples", "libraries"].flatMap((d) =>
    fs.existsSync(path.join(root, d)) ? fs.readdirSync(path.join(root, d)).map((n) => `${d}/${n}`) : [],
  );
  for (const d of [...tops, "tooling", "evals"]) {
    try {
      const name = JSON.parse(fs.readFileSync(path.join(root, d, "package.json"), "utf8")).name;
      if (typeof name === "string") dirs[name] = d;
    } catch {}
  }
  return dirs;
}

const [task, ...extra] = process.argv.slice(2).filter((a) => !["--quiet"].includes(a) && !a.startsWith("--format"));
const NOISE = [
  /^\s*$/,
  /cache (miss|hit)/,
  /^\S+:\S+: *$/,
  /^\S+:\S+: > /,
  / ERROR /,
  /ELIFECYCLE/,
  /^\s*•/,
  /^\s*Tasks:/,
  /^\s*Cached:/,
  /^\s*Time:/,
  /^\s*Summary:/,
  /^\s*Failed:/,
  /no output files found/,
  /^> keel@/,
  /^\s*Running \w+ in \d+ packages/,
  /Remote caching/,
  /^\s*(ELIFECYCLE|ERROR)\b/,
  / WARNING {2}command finished with error, but continuing/,
];

// Test and coverage tasks run as many at once, with as many vitest workers each, as the cores the machine's load
// leaves free allow (test-slots.mjs): four tasks when it is quiet, down to two with few workers each at load 40 on
// 16 cores, one on a machine of four cores or fewer (a CI runner). `--concurrency` and `KEEL_TEST_TASKS` set the
// tasks, `KEEL_TEST_WORKERS` the workers of each.
const vitestTask = task === "test" || task === "coverage";
const slots = testSlots({ cores: os.availableParallelism(), load: os.loadavg()[0] ?? 0, env: process.env });
const limit = vitestTask && !extra.some((a) => a.startsWith("--concurrency")) ? [`--concurrency=${slots.tasks}`] : [];
const workers = vitestTask && slots.workers !== undefined ? { KEEL_TEST_WORKERS: String(slots.workers) } : {};
// Mutation runs one package at a time (each Stryker run fills the cores) and one run per machine.
const one = task === "mutate" && !extra.some((a) => a.startsWith("--concurrency")) ? ["--concurrency=1"] : [];
// A failed task does not cancel the rest (turbo's default does): every task runs to its own verdict, so a gate's
// output holds every failure, and a task cancelled after another failed cannot read as a pass.
const go =
  task !== "mutate" && !extra.some((a) => a.startsWith("--continue")) ? ["--continue=dependencies-successful"] : [];

await run(task ?? "turbo", () => {
  // A test run beside a mutation run is slow and its timeouts may fire: it runs anyway and says so (W0012).
  const warn = [];
  if (vitestTask) {
    const holder = heldBy();
    if (holder !== undefined) warn.push(busyDiag(holder));
  }
  if (task === "mutate") {
    const lock = acquire();
    if (!lock.held) return { diags: [lockedDiag(lock.holder)], counts: { tasks: 0 } };
  }
  const r = spawnSync(
    "pnpm",
    [
      "exec",
      "turbo",
      "run",
      task,
      "--output-logs=errors-only",
      // Every line of a task's log carries its `<pkg>:<task>: ` prefix, under GitHub Actions too (turbo's default
      // there groups a task's lines unprefixed), so taskFailures finds a failed task's own diagnostics.
      "--log-prefix=task",
      "--ui=stream",
      "--no-color",
      ...limit,
      ...one,
      ...go,
      ...extra,
    ],
    {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, ...workers, TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" },
      maxBuffer: 256 * 1024 * 1024,
    },
  );
  const all = `${r.stdout}\n${r.stderr}`;
  const v = turboVerdict(r.status, all);
  const tasks = v.successful;
  if (v.ok) return { diags: warn, counts: { tasks } };
  const failures = taskFailures(v.failed, all, workspaceDirs(ROOT));
  const out = [];
  for (const f of failures) {
    out.push(`${f.task} ${f.trailer ?? `exit ${f.exit ?? "?"}`}`);
    // Each failed test's line with its fix lines; a task that named no test shows how its log ended.
    out.push(...(f.diags.length > 0 ? f.lines.slice(0, 40) : f.tail.map((l) => `  ${l}`)));
  }
  if (failures.length === 0) {
    const lines = all
      .split("\n")
      .map((l) => l.replace(/^\S+:\S+: /, ""))
      .filter((l) => !NOISE.some((n) => n.test(l)));
    out.push(...lines.slice(-30));
  }
  process.stdout.write(`${out.join("\n")}\n`);
  return {
    diags: [...warn, { kind: "diag", code: "E0005", message: failVerdict(task ?? "turbo", v, failures) }],
    counts: { tasks, failed: v.failed.length, unfinished: v.unfinished },
    exit: r.status === 0 || r.status === null ? 1 : r.status,
  };
});
