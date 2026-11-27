import { mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sha256Hex } from "../sha256Hex.ts";
import type { CacheInput } from "./CacheInput.ts";
import type { Evaluation } from "./Evaluation.ts";
import { cacheKey } from "./cacheKey.ts";

/** A folder keeps at most this many entries; each write removes the least recently written beyond them. */
const KEEP = 4;

/**
 * Store `e` in the cache folder `dir` with its recorded `inputs`, for a project whose code file paths are `paths`
 * (k.derived Derivation cache): one JSON file named by the SHA-256 of its key and inputs, holding them and the
 * evaluation, written to `<name>.<pid>.tmp` and renamed into place. Entries beyond `KEEP`, least recently written
 * first, and other `*.tmp` files are removed. A failed write is ignored.
 */
export function cacheWrite(
  dir: string,
  root: string,
  paths: readonly string[],
  inputs: readonly CacheInput[],
  e: Evaluation,
): void {
  const key = cacheKey(root, paths);
  const { routes, surface, problems } = e;
  const name = `${sha256Hex(new TextEncoder().encode(JSON.stringify({ key, inputs })))}.json`;
  const own = `${name}.${process.pid}.tmp`;
  try {
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, own), `${JSON.stringify({ key, inputs, evaluation: { routes, surface, problems } })}\n`);
    renameSync(join(dir, own), join(dir, name));
    const entries = readdirSync(dir);
    for (const n of entries) if (n.endsWith(".tmp") && n !== own) rmSync(join(dir, n), { force: true });
    const kept = entries
      .filter((n) => n.endsWith(".json") && n !== name)
      .map((n) => ({ n, t: statSync(join(dir, n)).mtimeMs }))
      .sort((a, b) => b.t - a.t);
    for (const { n } of kept.slice(KEEP - 1)) rmSync(join(dir, n), { force: true });
  } catch {
    // A failed write is a miss later (k.derived Derivation cache).
  }
}
