// Wraps `turbo run <task>` so success is one trailer line and failure is only the failing packages' logs.
// Usage: node tooling/turbo.mjs <task> [turbo args...]
import { spawnSync } from "node:child_process";
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

await run(task ?? "turbo", () => {
  const r = spawnSync(
    "pnpm",
    ["exec", "turbo", "run", task, "--output-logs=errors-only", "--ui=stream", "--no-color", ...extra],
    {
      cwd: new URL("..", import.meta.url).pathname,
      encoding: "utf8",
      env: { ...process.env, TURBO_NO_UPDATE_NOTIFIER: "1", NO_COLOR: "1" },
    },
  );
  const all = `${r.stdout}\n${r.stderr}`;
  const tasks = Number(/Tasks:\s+(\d+) successful/.exec(all)?.[1] ?? 0);
  if (r.status === 0) return { diags: [], counts: { tasks } };
  const lines = all
    .split("\n")
    .map((l) => l.replace(/^\S+:\S+: /, ""))
    .filter((l) => !NOISE.some((n) => n.test(l)));
  console.log(lines.slice(0, 60).join("\n") + (lines.length > 60 ? `\n... +${lines.length - 60} more lines` : ""));
  return {
    diags: [{ kind: "diag", code: "E0005", message: `turbo ${task} failed` }],
    counts: { tasks },
    exit: r.status ?? 1,
  };
});
