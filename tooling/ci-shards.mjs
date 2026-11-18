// CI's test split (the `test-shard` job of tooling/ci.source.json). Every workspace package with a test task lands in
// exactly one shard; the shard count is the length of that job's matrix; packages are dealt largest first, by count of
// test files, each to the shard with the fewest files so far, so a new package joins a shard without an edit here.
// Usage: node tooling/ci-shards.mjs <shard>   runs that shard's test tasks through turbo, one at a time, each task's
//                                            log printed as it finishes, so a run cut short shows where it stood
//        node tooling/ci-shards.mjs --verify  fails E0013 when a test task falls in no shard, in two, or the matrix
//                                            does not count 1 to n
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { run } from "./output.ts";

const root = new URL("..", import.meta.url).pathname;
const SKIP = new Set(["node_modules", "dist", "fixtures", "reports", "coverage"]);
const TEST = /\.test\.[cm]?[jt]sx?$/;
const env = { ...process.env, TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" };

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

/** The shards, each a list of package names, dealt largest first to the lightest shard. */
function deal(tasks) {
  const weighed = tasks
    .map((t) => ({ name: t.name, w: countTests(path.join(root, t.dir)) }))
    .sort((a, b) => b.w - a.w || a.name.localeCompare(b.name));
  const shards = Array.from({ length: n }, () => ({ w: 0, names: [] }));
  for (const p of weighed) {
    const lightest = shards.reduce((a, b) => (b.w < a.w ? b : a));
    lightest.w += p.w;
    lightest.names.push(p.name);
  }
  return shards.map((s) => s.names.sort());
}

const filters = (names) => names.map((p) => `--filter=${p}`);
const arg = process.argv[2];

if (arg === "--verify") {
  await run("ci-shards", () => {
    const diags = [];
    const fail = (message) => diags.push({ kind: "diag", code: "E0013", path: "tooling/ci.source.json", message });
    if (matrix.some((s, i) => s !== i + 1)) fail(`test-shard matrix is ${JSON.stringify(matrix)}, not 1 to ${n}`);
    const all = testTasks().map((t) => t.name);
    const seen = new Map();
    for (const [i, names] of deal(testTasks()).entries())
      for (const name of names.length === 0 ? [] : testTasks(filters(names)).map((t) => t.name))
        seen.set(name, [...(seen.get(name) ?? []), i + 1]);
    for (const name of all) {
      const at = seen.get(name) ?? [];
      if (at.length !== 1)
        fail(`${name} runs its tests in ${at.length === 0 ? "no shard" : `shards ${at.join(", ")}`}`);
    }
    for (const name of seen.keys()) if (!all.includes(name)) fail(`${name} is in a shard but has no test task`);
    return { diags, counts: { packages: all.length, shards: n } };
  });
} else {
  const shard = Number(arg);
  await run(`ci-shard ${arg}/${n}`, () => {
    if (!Number.isInteger(shard) || shard < 1 || shard > n)
      return {
        diags: [{ kind: "diag", code: "E0013", message: `shard ${arg} is not between 1 and ${n}` }],
        counts: {},
      };
    const names = deal(testTasks())[shard - 1];
    const gb = (os.totalmem() / 2 ** 30).toFixed(1);
    console.log(`shard ${shard}/${n} on ${os.availableParallelism()} cores, ${gb} GB: ${names.join(" ")}`);
    const r = spawnSync(
      "pnpm",
      [
        "exec",
        "turbo",
        "run",
        "test",
        ...filters(names),
        "--concurrency=1",
        "--output-logs=new-only",
        "--ui=stream",
        "--no-color",
      ],
      { cwd: root, stdio: "inherit", env },
    );
    const counts = { packages: names.length };
    if (r.status === 0) return { diags: [], counts };
    return {
      diags: [{ kind: "diag", code: "E0005", message: `turbo test failed in shard ${shard}/${n}` }],
      counts,
      exit: r.status ?? 1,
    };
  });
}
