// A package's mutation run in shards: every mutated file belongs to one of N shards by a hash of its package-relative
// path, so the split is the same on every machine and every run, and a shard is a slice of the package's files.
//   node tooling/mutate-shard.mjs list <i>/<N> [dir]      the files of shard i (1-based) of the unit in dir (default .)
//   node tooling/mutate-shard.mjs merge <out> <dir>        merges `<dir>/*-shard-<i>-of-<N>/mutation.json` into <out>
// `tooling/mutate.mjs --shard i/N` (or KEEL_MUTATE_SHARD=i/N) runs one shard.
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { run } from "./output.ts";

/** `{ i, n }` from `i/N` (1 <= i <= N), or undefined when the text is not one. */
export function parseShard(text) {
  const m = /^(\d+)\/(\d+)$/.exec(String(text ?? "").trim());
  if (!m) return undefined;
  const i = Number(m[1]);
  const n = Number(m[2]);
  return n >= 1 && i >= 1 && i <= n ? { i, n } : undefined;
}

/** The shard (1-based) of a package-relative path among `n`: the first four bytes of its sha256, modulo n, plus one. */
export function shardOf(file, n) {
  const rel = file.split(path.sep).join("/");
  return (createHash("sha256").update(rel).digest().readUInt32BE(0) % n) + 1;
}

/** A Stryker `mutate` glob as a RegExp over package-relative paths: `**` spans directories, `*` and `?` do not. */
export function globToRegExp(glob) {
  let re = "";
  for (let k = 0; k < glob.length; k++) {
    const c = glob[k];
    if (c === "*" && glob[k + 1] === "*") {
      k++;
      if (glob[k + 1] === "/") {
        k++;
        re += "(?:.*/)?";
      } else re += ".*";
    } else if (c === "*") re += "[^/]*";
    else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

/** The files under `dir` (package-relative, sorted) that `globs` mutate: matched by a positive glob, by no `!` glob. */
export function mutatedFiles(dir, globs) {
  const plus = globs.filter((g) => !g.startsWith("!")).map(globToRegExp);
  const minus = globs.filter((g) => g.startsWith("!")).map((g) => globToRegExp(g.slice(1)));
  const out = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name !== "node_modules" && !e.name.startsWith(".")) walk(p);
      } else if (plus.some((r) => r.test(p)) && !minus.some((r) => r.test(p))) out.push(p);
    }
  };
  walk("");
  return out.sort();
}

/** The files of shard `i` of `n` among `files`. */
export const shardFiles = (files, i, n) => files.filter((f) => shardOf(f, n) === i);

/** The `mutate` globs of the Stryker config in `dir`. */
export async function configGlobs(dir) {
  const mod = await import(pathToFileURL(path.join(dir, "stryker.config.mjs")).href);
  const globs = mod.default?.mutate;
  if (!Array.isArray(globs) || !globs.every((g) => typeof g === "string"))
    throw new Error(`${path.join(dir, "stryker.config.mjs")}: no mutate globs`);
  return globs;
}

/** `{ i, n }` from the run's args (`--shard i/N`, `--shard=i/N`) or KEEL_MUTATE_SHARD; `rest` is the args without it. */
export function shardArg(args, env = process.env) {
  const rest = [];
  let text;
  for (let k = 0; k < args.length; k++) {
    const a = args[k];
    if (a === "--shard") text = args[++k];
    else if (a.startsWith("--shard=")) text = a.slice("--shard=".length);
    else rest.push(a);
  }
  text ??= env.KEEL_MUTATE_SHARD || undefined;
  if (text === undefined) return { rest };
  const shard = parseShard(text);
  if (!shard) return { rest, error: `--shard wants i/N with 1 <= i <= N, got ${text}` };
  return { rest, shard };
}

/**
 * One report from the shard reports `parts` (`{ i, n, report }`, mutation-testing-elements JSON): each file's entry
 * from the shard that owns it, test files merged by file and test name with the mutants' test ids renamed to match.
 * `missing` lists the shards of 1..n with no part.
 */
export function mergeReports(parts) {
  if (parts.length === 0) throw new Error("no shard reports to merge");
  const n = parts[0].n;
  if (parts.some((p) => p.n !== n)) throw new Error("shard reports of different shard counts");
  const sorted = [...parts].sort((a, b) => a.i - b.i);
  const files = {};
  const testFiles = {};
  const ids = new Map(); // `${file}\0${name}` -> merged id
  for (const { i, report } of sorted) {
    const rename = new Map();
    for (const [tf, entry] of Object.entries(report.testFiles ?? {})) {
      const target = (testFiles[tf] ??= { ...entry, tests: [] });
      for (const t of entry.tests ?? []) {
        const key = `${tf}\0${t.name}`;
        let id = ids.get(key);
        if (id === undefined) {
          id = String(ids.size);
          ids.set(key, id);
          target.tests.push({ ...t, id });
        }
        rename.set(t.id, id);
      }
    }
    const ren = (list) => (Array.isArray(list) ? list.map((x) => rename.get(x) ?? x) : list);
    for (const [file, entry] of Object.entries(report.files ?? {})) {
      if (shardOf(file, n) !== i) continue;
      files[file] = {
        ...entry,
        mutants: entry.mutants.map((m) => ({
          ...m,
          ...(m.coveredBy ? { coveredBy: ren(m.coveredBy) } : {}),
          ...(m.killedBy ? { killedBy: ren(m.killedBy) } : {}),
        })),
      };
    }
  }
  const have = new Set(sorted.map((p) => p.i));
  const missing = [];
  for (let k = 1; k <= n; k++) if (!have.has(k)) missing.push(k);
  const sortedFiles = Object.fromEntries(
    Object.keys(files)
      .sort()
      .map((f) => [f, files[f]]),
  );
  return { report: { ...sorted[0].report, files: sortedFiles, testFiles }, missing };
}

const SHARD_DIR = /-shard-(\d+)-of-(\d+)$/;

/** The shard reports under `dir`: each `<name>-shard-<i>-of-<N>/mutation.json`. */
export function readParts(dir) {
  const parts = [];
  for (const d of fs.readdirSync(dir).sort()) {
    const m = SHARD_DIR.exec(d);
    const file = path.join(dir, d, "mutation.json");
    if (!m || !fs.existsSync(file)) continue;
    parts.push({ i: Number(m[1]), n: Number(m[2]), report: JSON.parse(fs.readFileSync(file, "utf8")) });
  }
  return parts;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const [cmd, a, b] = process.argv.slice(2).filter((x) => !x.startsWith("--"));
  if (cmd === "list")
    await run("mutate-shard", async () => {
      const shard = parseShard(a);
      if (!shard) return { diags: [{ kind: "diag", code: "E0016", message: `list wants i/N, got ${a}` }], counts: {} };
      const dir = path.resolve(b ?? ".");
      const files = shardFiles(mutatedFiles(dir, await configGlobs(dir)), shard.i, shard.n);
      for (const f of files) console.log(f);
      return { diags: [], counts: { files: files.length } };
    });
  else if (cmd === "merge")
    await run("mutate-shard", () => {
      const parts = readParts(path.resolve(b));
      if (parts.length === 0)
        return { diags: [{ kind: "diag", code: "E0016", message: `no shard reports under ${b}` }], counts: {} };
      const { report, missing } = mergeReports(parts);
      fs.mkdirSync(path.dirname(path.resolve(a)), { recursive: true });
      fs.writeFileSync(path.resolve(a), JSON.stringify(report));
      const diags = missing.map((k) => ({
        kind: "diag",
        code: "W0015",
        message: `shard ${k} of ${parts[0].n} wrote no report; its files keep their committed claims`,
      }));
      return { diags, counts: { shards: parts.length, files: Object.keys(report.files).length } };
    });
  else {
    console.log("E0016 usage: mutate-shard.mjs list <i>/<N> [dir] | merge <out> <dir>");
    process.exitCode = 2;
  }
}
