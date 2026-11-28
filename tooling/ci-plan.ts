// The plan of CI's test split (tooling/ci-shards.mjs) and the times it rests on (tooling/ci-shards.json). A package's
// weight is its test task's seconds on the hosted runner as the latest shard logs recorded them; a package listed in
// SPLIT runs as parts (vitest's `--shard=i/k`), and its files go to the parts by their own recorded seconds, heaviest
// first to the lightest part (`splitFiles`), the deal `TimedSequencer` (ci-sequencer.ts) makes inside vitest. Units,
// whole packages and parts, go to the shards the same way (`deal`). `parseShardLog` and `mergeTimes` read the times
// back from the shard logs, for `node tooling/ci-shards.mjs --refresh <run-id>...`.

import { readFileSync } from "node:fs";

/**
 * Packages whose test task runs as several parts, each in its own shard, with the part count. `@keel/cli` runs builds
 * and TypeScript programs in most files; whole, it takes over an hour on the hosted runner.
 */
export const SPLIT: Readonly<Record<string, number>> = { "@keel/cli": 6 };

/**
 * Packages whose test files run on at most this many vitest workers in a shard. `@keel/cli`'s property tests spawn
 * several builds per run under a per-test time limit; with a worker per core the builds wait on each other and a test
 * ends at its limit on a slow runner.
 */
export const WORKERS: Readonly<Record<string, number>> = { "@keel/cli": 2 };

/** Weight per test file of a package the times do not list. */
export const SECONDS_PER_FILE = 5;

/** The recorded times: per test task, per test file of a split package, and each split package's parallel factor. */
export type Times = {
  /** The CI runs the times were read from. */
  runs: string[];
  /** Seconds of each package's whole test task (split packages are not listed). */
  packages: Record<string, number>;
  /** Seconds of each test file of a split package, by its path from the package root. */
  files: Record<string, Record<string, number>>;
  /** A split package's part seconds over the sum of its files' seconds, the most any finished part showed. */
  parallel: Record<string, number>;
};

/** What a weight is when nothing was recorded for a file: the mean of the package's recorded files, else the default. */
function fallback(seconds: Record<string, number>): number {
  const all = Object.values(seconds);
  return all.length === 0 ? SECONDS_PER_FILE : all.reduce((a, b) => a + b, 0) / all.length;
}

/** A file's weight: its recorded seconds, else the package's fallback. */
const fileWeight = (seconds: Record<string, number>, fill: number, f: string): number => seconds[f] ?? fill;

/**
 * The files of each of `parts` parts: heaviest first (path order on a tie), each to the part with the least seconds so
 * far (the lowest index on a tie). The same files and times give the same parts on every machine.
 */
export function splitFiles(files: readonly string[], seconds: Record<string, number>, parts: number): string[][] {
  const fill = fallback(seconds);
  const weighed = [...new Set(files)]
    .map((f) => ({ f, w: fileWeight(seconds, fill, f) }))
    .sort((a, b) => b.w - a.w || (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  const out = Array.from({ length: parts }, (): { w: number; files: string[] } => ({ w: 0, files: [] }));
  for (const x of weighed) {
    let least = 0;
    for (let i = 1; i < out.length; i++) if ((out[i]?.w ?? 0) < (out[least]?.w ?? 0)) least = i;
    const part = out[least];
    if (part === undefined) continue;
    part.w += x.w;
    part.files.push(x.f);
  }
  return out.map((p) => p.files.sort());
}

/**
 * A part's expected seconds: the sum of its files' seconds times the package's parallel factor, and never less than
 * its slowest file, which one worker runs alone.
 */
export function partSeconds(files: readonly string[], seconds: Record<string, number>, parallel: number): number {
  const fill = fallback(seconds);
  const ws = files.map((f) => fileWeight(seconds, fill, f));
  return Math.ceil(Math.max(ws.reduce((a, b) => a + b, 0) * parallel, ...ws, 0));
}

/** A test task as turbo plans it, with its test files when it is split. */
export type Task = { name: string; dir: string; files?: readonly string[]; testFiles?: number };

/** A unit of the deal: a package's whole test task, or part `part` of `parts` of a split one, with its seconds. */
export type Unit = { name: string; part: number; parts: number; w: number; files?: string[] };

export const label = (u: Pick<Unit, "name" | "part" | "parts">): string =>
  u.parts === 1 ? u.name : `${u.name} ${u.part}/${u.parts}`;

/** Every task as its units: a split package's parts with their files, each unit with its expected seconds. */
export function units(tasks: readonly Task[], times: Times, split: Readonly<Record<string, number>> = SPLIT): Unit[] {
  return tasks.flatMap((t): Unit[] => {
    const parts = split[t.name];
    if (parts === undefined || parts < 2) {
      const w = times.packages[t.name] ?? SECONDS_PER_FILE * (t.testFiles ?? 1);
      return [{ name: t.name, part: 1, parts: 1, w: Math.ceil(w) }];
    }
    const seconds = times.files[t.name] ?? {};
    const parallel = times.parallel[t.name] ?? 1;
    return splitFiles(t.files ?? [], seconds, parts).map((files, i) => ({
      name: t.name,
      part: i + 1,
      parts,
      w: partSeconds(files, seconds, parallel),
      files,
    }));
  });
}

/** A shard: its units and expected seconds. */
export type Shard = { seconds: number; units: Unit[] };

/**
 * The `n` shards: units heaviest first (label order on a tie), each to the lightest shard that holds no other part of
 * the same package.
 */
export function deal(all: readonly Unit[], n: number): Shard[] {
  const weighed = [...all].sort((a, b) => b.w - a.w || label(a).localeCompare(label(b)));
  const shards = Array.from({ length: n }, (): Shard => ({ seconds: 0, units: [] }));
  for (const u of weighed) {
    const open = shards.filter((s) => u.parts === 1 || !s.units.some((v) => v.name === u.name));
    const from = open.length > 0 ? open : shards;
    const first = from[0];
    if (first === undefined) continue;
    const lightest = from.reduce((a, b) => (b.seconds < a.seconds ? b : a), first);
    lightest.seconds += u.w;
    lightest.units.push(u);
  }
  return shards.map((s) => ({ seconds: s.seconds, units: s.units.sort((a, b) => label(a).localeCompare(label(b))) }));
}

/** One shard job's log, read: each task's seconds (`cut` when the log ends inside it) and each test file's seconds. */
export type ShardLog = {
  tasks: Record<string, { seconds: number; cut: boolean }>;
  files: Record<string, Record<string, number>>;
};

/** The time stamp a GitHub Actions log line carries (after the job and step columns, or first), in ms. */
function stamp(line: string): number | undefined {
  const m = line.match(/(?:^|\t)(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) /);
  const t = m?.[1] === undefined ? Number.NaN : Date.parse(m[1]);
  return Number.isNaN(t) ? undefined : t;
}

/**
 * Reads a test-shard job's log (`gh run view --job <id> --log`): the closing `ok <task> test <s>s` and `fail ...`
 * lines give a task's seconds; a task without one (the job ended first) runs from its `run <task> test` line to the
 * next one, or to the log's end, `cut`. Each `<package>:test: file <path> <s>s` line gives a file's seconds.
 */
export function parseShardLog(text: string): ShardLog {
  const tasks: ShardLog["tasks"] = {};
  const files: ShardLog["files"] = {};
  const started: { name: string; t: number }[] = [];
  let last: number | undefined;
  for (const line of text.split("\n")) {
    const t = stamp(line);
    if (t !== undefined) last = t;
    const run = line.match(/ run (\S+(?: \d+\/\d+)?) test$/);
    if (run?.[1] !== undefined && t !== undefined) started.push({ name: run[1], t });
    const done = line.match(/ (?:ok|fail) (\S+(?: \d+\/\d+)?) test (\d+(?:\.\d+)?)s\b/);
    if (done?.[1] !== undefined && done[2] !== undefined) tasks[done[1]] = { seconds: Number(done[2]), cut: false };
    const file = line.match(/ (\S+):test: file (\S+) (\d+(?:\.\d+)?)s$/);
    if (file?.[1] !== undefined && file[2] !== undefined && file[3] !== undefined) {
      const own = files[file[1]] ?? {};
      own[file[2]] = Number(file[3]);
      files[file[1]] = own;
    }
  }
  for (const [i, s] of started.entries()) {
    if (tasks[s.name] !== undefined) continue;
    const next = started[i + 1];
    const end = next?.t ?? last ?? s.t;
    tasks[s.name] = { seconds: (end - s.t) / 1000, cut: next === undefined };
  }
  return { tasks, files };
}

const up = (x: number, places: number): number => Math.ceil(x * 10 ** places) / 10 ** places;

/**
 * The times from several runs' shard logs: per task and per file the most any run took (a cut task's seconds are the
 * least it takes, so they count too), and per split package the highest ratio of a finished part's seconds to the
 * sum of its files' seconds. Keys are sorted.
 */
export function mergeTimes(runs: readonly string[], logs: readonly ShardLog[]): Times {
  const packages: Record<string, number> = {};
  const files: Record<string, Record<string, number>> = {};
  const parallel: Record<string, number> = {};
  for (const log of logs) {
    for (const [name, task] of Object.entries(log.tasks)) {
      const pkg = name.replace(/ \d+\/\d+$/, "");
      if (pkg !== name) {
        const own = log.files[pkg] ?? {};
        const sum = Object.values(own).reduce((a, b) => a + b, 0);
        if (!task.cut && sum > 0) parallel[pkg] = Math.max(parallel[pkg] ?? 0, up(task.seconds / sum, 2));
        continue;
      }
      packages[name] = Math.max(packages[name] ?? 0, Math.ceil(task.seconds));
    }
    for (const [pkg, own] of Object.entries(log.files)) {
      const all = files[pkg] ?? {};
      for (const [f, s] of Object.entries(own)) all[f] = Math.max(all[f] ?? 0, s);
      files[pkg] = all;
    }
  }
  for (const pkg of Object.keys(files)) if (parallel[pkg] === undefined) delete files[pkg];
  const sorted = <T>(o: Record<string, T>): Record<string, T> =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return {
    runs: [...runs],
    packages: sorted(packages),
    files: sorted(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, sorted(v)]))),
    parallel: sorted(parallel),
  };
}

const TIMES = new URL("./ci-shards.json", import.meta.url);

/** The recorded times, tooling/ci-shards.json. */
export const readTimes = (): Times => asTimes(JSON.parse(readFileSync(TIMES, "utf8")));

/** Narrows parsed JSON to `Times`, or throws naming what is wrong. */
export function asTimes(x: unknown): Times {
  const record = (v: unknown, what: string): Record<string, unknown> => {
    if (typeof v !== "object" || v === null || Array.isArray(v)) throw new Error(`${what} is not an object`);
    return Object.fromEntries(Object.entries(v));
  };
  const numbers = (v: unknown, what: string): Record<string, number> => {
    const out: Record<string, number> = {};
    for (const [k, n] of Object.entries(record(v, what))) {
      if (typeof n !== "number" || !Number.isFinite(n) || n < 0) throw new Error(`${what}.${k} is not a time`);
      out[k] = n;
    }
    return out;
  };
  const top = record(x, "times");
  const runs = top.runs;
  if (!Array.isArray(runs) || !runs.every((r) => typeof r === "string")) throw new Error("times.runs is not a list");
  return {
    runs: runs.map(String),
    packages: numbers(top.packages, "times.packages"),
    files: Object.fromEntries(
      Object.entries(record(top.files, "times.files")).map(([k, v]) => [k, numbers(v, `times.files.${k}`)]),
    ),
    parallel: numbers(top.parallel, "times.parallel"),
  };
}
