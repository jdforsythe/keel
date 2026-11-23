// The pure part of `pnpm mutate:stale`: which mutated `src` files have a stale, partial or missing mutation claim, and
// how they are cut into chunks. Reads nothing; tooling/mutate-stale.mjs feeds it the ledger's claims and the files' hashes.
import { mutatedRule, unitDir } from "./mutate-units.mjs";

const SCORED = new Set(["Killed", "Timeout", "Survived", "NoCoverage"]);

/**
 * What a Stryker report on disk says of the files it holds, for the unit whose directory is `dir` (repo-relative):
 * `claims` (`{ file, sha }`, the sha of the source the report holds) for each file with a scored mutant, and `inert`
 * (`{ file, sha }` too), the files it holds with none (all their mutants ignored), which have nothing to run while the sha holds. `sha256` hashes a source text.
 */
export function reportClaims(dir, report, sha256) {
  const claims = [];
  const inert = [];
  const files = report?.files;
  if (files === null || typeof files !== "object") return { claims, inert };
  for (const [rel, entry] of Object.entries(files)) {
    if (typeof entry?.source !== "string") continue;
    const file = `${dir}/${rel}`;
    const scored = Array.isArray(entry.mutants) && entry.mutants.some((m) => SCORED.has(m?.status));
    (scored ? claims : inert).push({ file, sha: sha256(entry.source) });
  }
  return { claims, inert };
}

/** One mutant as text: its mutator, its place counted from `base` (0 in the instrumenter, 1 in a report) and its replacement. */
const mutantKey = (m, base) => {
  const s = m?.location?.start;
  const e = m?.location?.end;
  return `${m?.mutatorName} ${s?.line - base}:${s?.column - base}-${e?.line - base}:${e?.column - base} ${m?.replacement}`;
};

/**
 * The repo-relative files of a Stryker report (of the unit whose directory is `dir`) whose entry does not hold exactly
 * the mutants the file has: fewer (a run stopped at its bound saves a file's NoCoverage and Ignored mutants at once and
 * drops the ones still waiting), more, or others. `found` maps a repo-relative file to the mutants Stryker's
 * instrumenter finds in its source, ignored ones included; a file it does not name is left out.
 */
export function partialFiles(dir, report, found) {
  const files = report?.files;
  if (files === null || typeof files !== "object") return [];
  const out = [];
  for (const [rel, entry] of Object.entries(files)) {
    const file = `${dir}/${rel}`;
    const mutants = found.get(file);
    if (mutants === undefined || typeof entry?.source !== "string") continue;
    const held = Array.isArray(entry.mutants) ? entry.mutants : [];
    const want = mutants.map((m) => mutantKey(m, 0)).sort();
    const have = held.map((m) => mutantKey(m, 1)).sort();
    if (want.length !== have.length || want.some((k, i) => k !== have[i])) out.push(file);
  }
  return out;
}

/**
 * The files to run, per unit (a bare package name, or `apps/<name>`) in `packages` order: `{ pkg, stale, missing }` (package-relative paths, sorted).
 * `claims` is the ledger's `mutation.claims` (`{ file, sha }`, file repo-relative); `shas` maps each repo-relative
 * mutated file on disk to the sha256 of its source. A claim whose sha differs from the disk is stale; a file with no
 * claim is missing; a file in `inert` (a set of repo-relative files with no mutant to run: zero mutants, or only ignored ones, as
 * its source is now) is neither. A file in `partial` (a set of repo-relative files whose report entry does not hold the
 * file's mutants, `partialFiles`) is stale whatever its claim or `inert` says. Packages with neither are left out.
 */
export function staleFiles(claims, shas, packages, inert = new Set(), partial = new Set()) {
  const claimed = new Map(claims.map((c) => [c.file, c.sha]));
  const out = [];
  for (const pkg of packages) {
    const prefix = `${unitDir(pkg)}/`;
    const mutated = mutatedRule(pkg);
    const stale = [];
    const missing = [];
    for (const file of [...shas.keys()].sort()) {
      if (!file.startsWith(prefix)) continue;
      const rel = file.slice(prefix.length);
      if (!mutated.test(rel)) continue;
      if (partial.has(file)) {
        stale.push(rel);
        continue;
      }
      if (inert.has(file)) continue;
      const sha = claimed.get(file);
      if (sha === undefined) missing.push(rel);
      else if (sha !== shas.get(file)) stale.push(rel);
    }
    if (stale.length || missing.length) out.push({ pkg, stale, missing });
  }
  return out;
}

/** Chunks of at most `size` files, in order, packages one after the other: `[{ pkg, files }]`. */
export function chunkPlan(entries, size, { missing = false } = {}) {
  const n = Math.max(1, Math.floor(size) || 1);
  const out = [];
  for (const e of entries) {
    const files = missing ? [...e.stale, ...e.missing] : e.stale;
    for (let i = 0; i < files.length; i += n) out.push({ pkg: e.pkg, files: files.slice(i, i + n) });
  }
  return out;
}

/** `N files left in M packages` for the chunks not yet run. */
export function leftLine(chunks) {
  const files = chunks.reduce((n, c) => n + c.files.length, 0);
  const pkgs = new Set(chunks.map((c) => c.pkg)).size;
  return `${files} ${files === 1 ? "file" : "files"} left in ${pkgs} ${pkgs === 1 ? "package" : "packages"}`;
}

/** The `--list` text: one `pkg: N files in M chunks` entry per package. */
export function listLine(chunks) {
  const by = new Map();
  for (const c of chunks) {
    const e = by.get(c.pkg) ?? { files: 0, chunks: 0 };
    by.set(c.pkg, { files: e.files + c.files.length, chunks: e.chunks + 1 });
  }
  return [...by].map(([pkg, e]) => `${pkg}(${e.files} files, ${e.chunks} chunks)`).join(",") || "none";
}

/** A positive integer flag value, else `fallback`. */
export function positive(text, fallback) {
  const n = Number(text);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** How a run ends: exit 130 and `stopped` after a signal or a stop file, `fail` for another non-zero exit, `ok` otherwise. */
export function endLine({ exit, signalled, stopped = false, left }) {
  const code = signalled || stopped ? 130 : exit;
  const word = code === 0 ? "ok" : code === 130 ? "stopped" : "fail";
  return { exit: code, line: `${word} mutate-stale ${leftLine(left)}; run again to resume` };
}
