// Wraps `turbo run <task>` so success is one trailer line and failure is only the failing packages' logs.
// Usage: node tooling/turbo.mjs <task> [turbo args...]
import { spawnSync } from "node:child_process";
import os from "node:os";
import { busyDiag, heldBy, acquire, lockedDiag } from "./mutateLock.mjs";
import { run } from "./output.ts";

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
];

// Each vitest run fills every core by itself, so test and coverage tasks run four at a time: more would starve the
// type-check heavy tests past their timeout without finishing sooner. On a machine with four cores or fewer (a CI
// runner) they run one at a time, for the same reason.
const atOnce = os.availableParallelism() <= 4 ? 1 : 4;
const vitestTask = task === "test" || task === "coverage";
const limit = vitestTask && !extra.some((a) => a.startsWith("--concurrency")) ? [`--concurrency=${atOnce}`] : [];
// Mutation runs one package at a time (each Stryker run fills the cores) and one run per machine.
const one = task === "mutate" && !extra.some((a) => a.startsWith("--concurrency")) ? ["--concurrency=1"] : [];

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
      "--ui=stream",
      "--no-color",
      ...limit,
      ...one,
      ...extra,
    ],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { ...process.env, TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" },
    },
  );
  const all = `${r.stdout}\n${r.stderr}`;
  const tasks = Number(/Tasks:\s+(\d+) successful/.exec(all)?.[1] ?? 0);
  if (r.status === 0) return { diags: warn, counts: { tasks } };
  const lines = all
    .split("\n")
    .map((l) => l.replace(/^\S+:\S+: /, ""))
    .filter((l) => !NOISE.some((n) => n.test(l)));
  console.log(lines.slice(0, 60).join("\n") + (lines.length > 60 ? `\n... +${lines.length - 60} more lines` : ""));
  return {
    diags: [...warn, { kind: "diag", code: "E0005", message: `turbo ${task} failed` }],
    counts: { tasks },
    exit: r.status ?? 1,
  };
});
