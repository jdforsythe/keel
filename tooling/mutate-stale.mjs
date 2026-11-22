import { spawn } from "node:child_process";
// A light mutation run for the files whose mutation claim is stale: the ledger's claim for a `src` file holds the sha256
// of the source it was scored on, and a file on disk with another hash (or, with --missing, none) is run again.
// Packages go one at a time, each in chunks of files through the one runner (tooling/mutate.mjs), with a capped number
// of test runners, so the run can share a machine. Nothing starts after --minutes; the live chunk is stopped through the
// stop path `pnpm mutate:stop` uses, so Stryker saves its results. Run again to resume: finished chunks are fresh.
// Usage: node tooling/mutate-stale.mjs [--list] [--only <pkg>] [--chunk <n=4>] [--concurrency <n=3>] [--minutes <n=20>] [--missing]
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { mutateCacheDir } from "./mutate-cache.ts";
import { stopRequested } from "./mutate-changed.mjs";
import { chunkPlan, endLine, listLine, positive, staleFiles } from "./mutate-stale-plan.mjs";
import { mutatedRule, mutationUnits, sourceDir, unitDir } from "./mutate-units.mjs";
import { stopFile } from "./mutate.mjs";
import { acquire, lockedDiag } from "./mutateLock.mjs";
import { run } from "./output.ts";

const root = path.join(import.meta.dirname, "..");
const argv = process.argv.slice(2);
const value = (name) => {
  const at = argv.findIndex((a) => a === `--${name}` || a.startsWith(`--${name}=`));
  if (at < 0) return undefined;
  return argv[at].includes("=") ? argv[at].slice(argv[at].indexOf("=") + 1) : argv[at + 1];
};
const sha256 = (text) => createHash("sha256").update(text).digest("hex");

/** Every mutated file of the units on disk, repo-relative, with the sha256 of its source. */
function hashes(units) {
  const out = new Map();
  for (const unit of units) {
    const mutated = mutatedRule(unit);
    const home = unitDir(unit);
    const walk = (dir, rel) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const r = `${rel}/${e.name}`;
        if (e.isDirectory()) walk(path.join(dir, e.name), r);
        else if (e.isFile() && mutated.test(r.slice(home.length + 1))) out.set(r, undefined);
      }
    };
    const src = path.join(root, home, sourceDir(unit));
    if (fs.existsSync(src)) walk(src, `${home}/${sourceDir(unit)}`);
  }
  for (const file of out.keys()) out.set(file, sha256(fs.readFileSync(path.join(root, file), "utf8")));
  return out;
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  await run("mutate-stale", async () => {
    const only = value("only");
    const size = positive(value("chunk"), 4);
    const minutes = positive(value("minutes"), 20);
    const concurrency = positive(value("concurrency"), 3);
    const missing = argv.includes("--missing");
    const all = mutationUnits(root).filter((p) => only === undefined || p === only);
    const ledger = JSON.parse(fs.readFileSync(path.join(root, "tooling", "ledger", "ledger.json"), "utf8"));
    const chunks = chunkPlan(staleFiles(ledger.mutation?.claims ?? [], hashes(all), all), size, { missing });
    if (argv.includes("--list") || chunks.length === 0)
      return {
        diags: [],
        counts: { chunks: chunks.length },
        line: `ok mutate-stale ${listLine(chunks)}${missing ? "" : " (stale only; --missing adds unclaimed files)"}`,
      };
    const lock = acquire();
    if (!lock.held) return { diags: [lockedDiag(lock.holder)], counts: { chunks: chunks.length } };
    const t0 = Date.now();
    const limit = t0 + minutes * 60000;
    const stops = stopFile(mutateCacheDir(root));
    let child;
    let signalled = false;
    let timedOut = false;
    let stopped = false;
    // A signal reaches the runner once (it owns the one SIGINT to its Stryker group) and ends the sequence with exit 130.
    for (const sig of ["SIGINT", "SIGTERM", "SIGHUP"])
      process.on(sig, () => {
        signalled = true;
        child?.kill(sig);
      });
    let exit = 0;
    let done = 0;
    for (const c of chunks) {
      if (signalled || timedOut || Date.now() >= limit) break;
      if (stopRequested(stops, t0)) {
        stopped = true;
        break;
      }
      const started = Date.now();
      // The capped test runners: a value already set in the environment wins.
      const env = {
        ...process.env,
        KEEL_MUTATE_CONCURRENCY: process.env.KEEL_MUTATE_CONCURRENCY || String(concurrency),
      };
      child = spawn("node", [path.join(root, "tooling", "mutate.mjs"), "--mutate", c.files.join(",")], {
        cwd: path.join(root, unitDir(c.pkg)),
        stdio: ["ignore", "pipe", "inherit"],
        env,
      });
      const out = [];
      child.stdout.on("data", (b) => out.push(b));
      // At the bound the live chunk is stopped as `pnpm mutate:stop` stops it: the runner sends Stryker its one SIGINT.
      const timer = setTimeout(
        () => {
          timedOut = true;
          spawn("node", [path.join(root, "tooling", "mutate.mjs"), "--stop"], { stdio: "ignore" });
        },
        Math.max(0, limit - Date.now()),
      );
      const status = await new Promise((resolve) => child.on("close", (code) => resolve(code ?? 1)));
      clearTimeout(timer);
      const text = Buffer.concat(out).toString("utf8").trimEnd().split("\n").pop() ?? "";
      console.log(
        `${c.pkg} ${c.files.length} files (${((Date.now() - started) / 1000).toFixed(0)}s): ${text || `exit ${status}`}`,
      );
      // A chunk stopped on the bound or by `mutate:stop` saved its results but is not finished: it stays in what is left.
      if (status === 130 && !timedOut) exit ||= status;
      if (status === 130 || timedOut) break;
      done++;
      exit ||= status;
    }
    const left = chunks.slice(done);
    const end = endLine({ exit, signalled, stopped, left });
    if (end.exit !== 0) console.log(end.line);
    return { diags: [], counts: { chunks: chunks.length, left: left.length }, exit: end.exit, line: end.line };
  });
}
