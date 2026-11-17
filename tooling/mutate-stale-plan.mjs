// The pure part of `pnpm mutate:stale`: which mutated `src` files have a stale or missing mutation claim, and how they
// are cut into chunks. Reads nothing; tooling/mutate-stale.mjs feeds it the ledger's claims and the files' hashes.

/** The path rule of a mutated file, package-relative (the one `mutate-changed` and Stryker's `mutate` globs use). */
export const MUTATED = /^src\/(?!index\.ts$)(?!types\/).+\.ts$/;

/**
 * The files to run, per package in `packages` order: `{ pkg, stale, missing }` (package-relative paths, sorted).
 * `claims` is the ledger's `mutation.claims` (`{ file, sha }`, file repo-relative); `shas` maps each repo-relative
 * mutated file on disk to the sha256 of its source. A claim whose sha differs from the disk is stale; a file with no
 * claim is missing. Packages with neither are left out.
 */
export function staleFiles(claims, shas, packages) {
  const claimed = new Map(claims.map((c) => [c.file, c.sha]));
  const out = [];
  for (const pkg of packages) {
    const prefix = `packages/${pkg}/`;
    const stale = [];
    const missing = [];
    for (const file of [...shas.keys()].sort()) {
      if (!file.startsWith(prefix)) continue;
      const rel = file.slice(prefix.length);
      if (!MUTATED.test(rel)) continue;
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
